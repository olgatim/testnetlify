+++
authors = ["Alban Crequy"]
date = "2018-02-20T15:55:56+02:00"
description = ""
draft = false
tags = ["bpf", "ebpf", "vcpu", "linux"]
title = "Timing issues when using BPF with virtual CPUs"
topics = ["Linux", "blog", "technical"]
postImage =  "article-hero.jpg"
+++

## Introduction

After implementing the collecting of TCP connections using eBPF in [Weave Scope](https://www.weave.works/oss/scope/) (see [our post](https://www.weave.works/blog/improving-performance-reliability-weave-scope-ebpf/) on the Weaveworks blog) we faced [an interesting bug](https://github.com/weaveworks/scope/issues/2650#issuecomment-316034572) that happened only in virtualized environments like AWS, but not on bare metal. The events retrieved via eBPF seemed to be received in the wrong chronological order. We are going to use this bug as an opportunity to discuss some interesting aspects of BPF and virtual CPUs (vCPUs).

## Background

Let's describe in more detail the scenario and provide some background on Linux clocks.

### Why is chronological order important for Scope?

Scope provides a visualization of network connections in distributed systems. To do this, Scope needs to maintain a list of current TCP connections. It does so by receiving TCP events from the kernel via the eBPF program we wrote, [tcptracer-bpf](https://github.com/weaveworks/tcptracer-bpf). Scope can receive either TCP `connect`, `accept`, or `close` events and update its internal state accordingly.

If events were to be received in the wrong order–a TCP `close` before a TCP `connect`–Scope would not be able to make sense of the events; the first TCP close would not match any existing connection that Scope knows of, and the second TCP `connect` would add a connection in the Scope internal state that will never be removed.

{{< figure src="/media/scope-tcp-events.svg" caption="TCP events sent from kernel space to userspace">}}

### How events are transferred from kernel to the Scope process?

Context switches and kernel/userspace transitions can be slow and we need an efficient way to transfer a large number of events. This is achieved using a perf ring buffer. A ring buffer or a  [circular buffer](https://www.kernel.org/doc/Documentation/circular-buffers.txt) is a data structure that allows a writer to send events to a reader asynchronously. The perf subsystem in the Linux kernel has a ring buffer implementation that allows a writer in the kernel to send events to a reader in userspace. It is done without any expensive locking mechanism by using well-placed [memory barriers](https://www.kernel.org/doc/Documentation/memory-barriers.txt).

On the kernel side, the BPF program writes an event in the ring buffer with the BPF helper function `bpf_perf_event_output()`, [introduced](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/commit/?id=a43eec304259a6c637f4014a6d4767159b6a3aa3) in Linux 4.4. On the userspace side, we can read the events either from an mmaped memory region (fast), or from a bpf map file descriptor with the `read()` system call (slower). Scope uses the fast method.

However, as soon as the computer has more than one CPU, several TCP events could happen simultaneously; one per CPU for example. This means there could be several writers at the same time and we will not be able to use a single ring buffer for everything. The solution is simple; use a different ring buffer for each CPU. On the kernel side, each CPU will write into its own ring buffer and the userspace process can read sequentially from all ring buffers.


{{< figure src="/media/tcptracer-bpf-diagram.svg" caption="TCP events traveling through ring buffers.">}}

### Multiple ring buffers introduces out-of-order events

Each ring buffer is normally ordered chronologically as expected because each CPU writes the events sequentially into the ring buffer. But on a busy system, there could be several events pending in each ring buffer. When the user-space process picks the events, at first it does not know whether the event from ring buffer `cpu#0` happened before or after the event from ring buffer `cpu#1`.

### Adding timestamps for sorting events

Fortunately, BPF has a simple way to address this: a bpf helper function called [`bpf_ktime_get_ns()` introduced in Linux 4.1](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/commit/?id=d9847d310ab4003725e6ed1822682e24bd406908) gives us a timestamp in nanoseconds. The TCP event written on the ring buffer is a struct. We simply added a field in the struct with a timestamp. When the userspace program receives events from different ring buffers, we sort the events according to the timestamp.

{{< figure src="/media/single-vCPU-timing-diagram.svg" width="500px" class="text-center" caption="The BPF program (in yellow) executed by a CPU calls two BPF helper functions: bpf_ktime_get_ns() and bpf_perf_event_output()">}}

### Sorting and synchronization

Sorting is actually not that simple because we don’t just have a set of events to sort. Instead, we have a dynamic system where several sources of events are continuously giving the process new events. As a result when sorting the events received at some point in time, there could be a scenario where we receive a new event that has to be placed before the events we are currently sorting. This is like sorting a set without knowing the complete set of items to sort.

To solve this problem, Scope needs a means of synchronization. Before we start gathering events and sorting, we measure the time with [`clock_gettime()`](http://man7.org/linux/man-pages/man2/clock_gettime.2.html). Then, we read events from all the ring buffers but stop processing a ring buffer if it is empty or if it gives us an event with a timestamp after the time of clock_gettime(). It is done in this way so as to only sort the events that are emitted before the beginning of the collection. New events will only be sorted in the next iteration.

### A word on different clocks

Linux has several clocks as you can see in the [`clock_gettime()` man page](http://man7.org/linux/man-pages/man2/clock_gettime.2.html). We need to use a monotonic clock, otherwise the timestamp from different events cannot be compared meaningfully. Non-monotonicity can come from clock updates from NTP, updates from other software (Google clock skew daemon), timezones, leap seconds, and other phenomena.

But also importantly, we need to use the same clock in the events (measured with the BPF helper function `bpf_ktime_get_ns`) and the userspace process (with system call `clock_gettime`), since we compare the two clocks. Fortunately, the BPF helper function gives us the equivalent of `CLOCK_MONOTONIC`.

Bugs in the Linux kernel can make the timestamp wrong. For example, a bug was [introduced in 4.8](https://github.com/torvalds/linux/commit/27727df240c7cc84f2ba6047c6f18d5addfd25ef) but was backported to older kernels by distros. The fix was [included in 4.9](https://github.com/torvalds/linux/commit/58bfea9532552d422bde7afa207e1a0f08dffa7d) and also backported. For example, in Ubuntu, the bug was introduced in kernel 4.4.0-42 and it's not fixed until kernel 4.4.0-51.

## The problem with vCPUs

The above scenario requires strictly reliable timing. But vCPUs don't make this straight-forward.

### Events are still unordered sometimes

Despite implementing all of this, we still sometimes noticed that events were ordered incorrectly. It happened rarely, like once every few days, and only on EC2 instances–not on bare-metal. What explains the difference of behaviour between virtualized environments and bare-metal?

To understand the difference, we’ll need to take a closer look at the source code. Scope uses the library [tcptracer-bpf](https://github.com/weaveworks/tcptracer-bpf) to load the BPF programs. The BPF programs are actually quite complex because they need to handle different cases: IPv4 vs IPv6, the asynchronous nature of TCP connect and the difficulty of passing contextes between BPF functions.  But, for the purpose of this race, we can simplify it to two function calls:
`bpf_ktime_get_ns()` to measure the time
`bpf_perf_event_output()` to write the event–including the timestamp–to the ring buffer

The way it was written, we assumed that the time between those two functions was negligible or at least constant. But in virtualized environments, **virtual CPUs (vCPU) can randomly sleep**, even inside BPF execution in kernel, depending on the hypervisor scheduling. So the time a BPF program takes to complete can vary from one execution to another.

Consider the following diagram:

{{< figure src="/media/vCPU-timing-diagram.svg" caption="Two CPUs executing the same BPF function concurrently" >}}

With a vCPU, we have no guarantees with respect to how long a BPF program will take between the two function calls–we've seen up to 98ms. It means that the userspace program does not have a guarantee that it will receive all the events before a specific timestamp.

In effect, this means we can not rely on absolute timing consistency on virtualization environments. This, unfortunately, means implementers must take such a scenario into consideration.

## Possible fixes

Any solution would have to ensure that the user-space Scope process waits enough time to have received the events from the different queues up to a specific time. One suggested solution was to regularly generate synchronization events on each CPU and deliver them on the same path in the ring buffers. This would ensure that one CPU is not sleeping for a long time without handling events.

But due to the difficulty of implementation and the rarity of the issue, we implemented [a workaround](https://github.com/weaveworks/scope/pull/2735) by just detecting when the problem happens and restarting the BPF engine in tcptracer-bpf.

## Conclusion

Investigating this bug and writing workaround patches for it made us write [a reproducer using CPU affinity primitives (taskset)](https://github.com/weaveworks/scope/issues/2650#issuecomment-314788229) and explore several complex aspects of Linux systems: virtual CPUs in hypervisors, clocks, ring buffers, and of course eBPF.

We'd be interested to hear from others who have encountered such issues with vCPUs and especially those who have additional insight or other ideas for proper fixes.

---

*Kinvolk is available for hire for Linux and Kubernetes based projects*

Follow us on [Twitter](https://twitter.com/kinvolkio) to get updates on what Kinvolk is up to.
