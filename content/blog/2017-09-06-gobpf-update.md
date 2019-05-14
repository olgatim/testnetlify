+++
authors = ["Michael Schubert"]
date = "2017-09-06T16:00:00+01:00"
description = "An update about changes to the gobpf library"
draft = false
tags = ["bpf", "ebpf", "gobpf", "golang"]
title = "An update on gobpf - ELF loading, uprobes, more program types"
topics = ["ebpf", "gobpf", "golang"]
postImage =  "article-hero.jpg"

+++

<figure class="img-fluid">
	<img src="/media/gopher-bpf-ninjas.png" class="img-fluid">
    <figcaption class="figure-caption"><a href="https://github.com/ashleymcnamara/gophers">Gophers</a> by <a href="https://twitter.com/ashleymcnamara">Ashley McNamara</a>, Ponies by <a href="https://twitter.com/DeirdreS">Deirdré Straughan</a> - <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY-NC-SA 4.0</a></figcaption>
</figure>

Almost a year ago we [introduced gobpf](https://kinvolk.io/blog/2016/11/introducing-gobpf---using-ebpf-from-go/), a Go library to load and use eBPF programs from Go applications. Today we would like to give you a quick update on the changes and features added since then (i.e. the highlights of `git log --oneline --no-merges --since="November 30th 2016" master`).
                                        
## Load BPF programs from ELF object files

With [commit 869e637](https://github.com/iovisor/gobpf/pull/6/commits/869e637f483f499254d57d443e7aaadad50dce24), gobpf was split into two subpackages (`github.com/iovisor/gobpf/bcc` and `github.com/iovisor/gobpf/elf`) and learned to load BPF programs from ELF object files. This allows users to pre-build their programs with clang/LLVM and its BPF backend as an alternative to using the [BPF Compiler Collection](https://github.com/iovisor/bcc).

One project where we at Kinvolk used pre-built ELF objects is the [TCP tracer](https://github.com/weaveworks/tcptracer-bpf) that we wrote for [Weave Scope](https://www.weave.works/oss/scope/). [Putting the program into the library](https://github.com/weaveworks/tcptracer-bpf/blob/9ce6fa0d051640576e014332aa9e1a33185c2b9b/pkg/tracer/tcptracer-ebpf.go#L71) allows us to `go get` and vendor the tracer as any other Go dependency.

Another important result of using the ELF loading mechanism is that the Scope container images are much smaller, as bcc and clang are not included and don’t add to the container image size.

Let’s see how this is done in practice by building a demo program to log `open(2)` syscalls to the [ftrace trace_pipe](https://www.kernel.org/doc/Documentation/trace/ftrace.txt):

```c
// program.c

#include <linux/kconfig.h>
#include <linux/bpf.h>

#include <uapi/linux/ptrace.h>

// definitions of bpf helper functions we need, as found in
// http://elixir.free-electrons.com/linux/latest/source/samples/bpf/bpf_helpers.h

#define SEC(NAME) __attribute__((section(NAME), used))

#define PT_REGS_PARM1(x) ((x)->di)

static int (*bpf_probe_read)(void *dst, int size, void *unsafe_ptr) =
        (void *) BPF_FUNC_probe_read;
static int (*bpf_trace_printk)(const char *fmt, int fmt_size, ...) =
        (void *) BPF_FUNC_trace_printk;

#define printt(fmt, ...)                                                   \
        ({                                                                 \
                char ____fmt[] = fmt;                                      \
                bpf_trace_printk(____fmt, sizeof(____fmt), ##__VA_ARGS__); \
        })

// the kprobe

SEC("kprobe/SyS_open")
int kprobe__sys_open(struct pt_regs *ctx)
{
        char filename[256];

        bpf_probe_read(filename, sizeof(filename), (void *)PT_REGS_PARM1(ctx));

        printt("open(%s)\n", filename);

        return 0;
}

char _license[] SEC("license") = "GPL";
// this number will be interpreted by the elf loader
// to set the current running kernel version
__u32 _version SEC("version") = 0xFFFFFFFE;
```

On a Debian system, the corresponding `Makefile` could look like this:

```make
# Makefile
# …

uname=$(shell uname -r)

build-elf:
        clang \
                -D__KERNEL__ \
                -O2 -emit-llvm -c program.c \
                -I /lib/modules/$(uname)/source/include \
                -I /lib/modules/$(uname)/source/arch/x86/include \
                -I /lib/modules/$(uname)/build/include \
                -I /lib/modules/$(uname)/build/arch/x86/include/generated \
                -o - | \
                llc -march=bpf -filetype=obj -o program.o
```

A small Go tool can then be used to load the object file and enable the kprobe with the help of gobpf:

```go
// main.go

package main

import (
        "fmt"
        "os"
        "os/signal"

        "github.com/iovisor/gobpf/elf"
)

func main() {
        module := elf.NewModule("./program.o")
        if err := module.Load(nil); err != nil {
                fmt.Fprintf(os.Stderr, "Failed to load program: %v\n", err)
                os.Exit(1)
        }
        defer func() {
                if err := module.Close(); err != nil {
                        fmt.Fprintf(os.Stderr, "Failed to close program: %v", err)
                }
        }()

        if err := module.EnableKprobe("kprobe/SyS_open", 0); err != nil {
                fmt.Fprintf(os.Stderr, "Failed to enable kprobe: %v\n", err)
                os.Exit(1)
        }

        sig := make(chan os.Signal, 1)
        signal.Notify(sig, os.Interrupt, os.Kill)

        <-sig
}
```

Now every time a process uses `open(2)`, the kprobe will log a message. Messages written with `bpf_trace_printk` can be seen in the `trace_pipe` “live trace”:

```bash
sudo cat /sys/kernel/debug/tracing/trace_pipe
```

With [go-bindata](https://github.com/jteeuwen/go-bindata) it’s possible to bundle the compiled BPF program into the Go binary to build a single _fat binary_ that can be shipped and installed conveniently.

## Trace user-level functions with bcc and uprobes

[Louis McCormack](https://github.com/louism517) contributed support for [uprobes](https://www.kernel.org/doc/Documentation/trace/uprobetracer.txt) in `github.com/iovisor/gobpf/bcc` and therefore it is now possible to trace user-level function calls. For example, to trace all `readline()` function calls from `/bin/bash` processes, you can run the [`bash_readline.go` demo](https://github.com/iovisor/gobpf/blob/de8c86d02193b02067206aae25dde87d2ac78245/examples/bcc/bash_readline/bash_readline.go):

```bash
sudo -E go run ./examples/bcc/bash_readline/bash_readline.go
```

## More supported program types for gobpf/elf

`gobpf/elf` learned to load programs of type `TRACEPOINT`, `SOCKET_FILTER`, `CGROUP_SOCK` and `CGROUP_SKB`:

### Tracepoints

A program of type `TRACEPOINT` can be attached to any [Linux tracepoint](https://www.kernel.org/doc/Documentation/trace/tracepoints.txt). Tracepoints in Linux are “a hook to call a function (probe) that you can provide at runtime.” A list of available tracepoints can be obtained with `find /sys/kernel/debug/tracing/events -type d`.

### Socket filtering

Socket filtering is the mechanism used by tcpdump to retrieve packets matching an expression. With `SOCKET_FILTER` programs, we can filter data on a socket by attaching them with `setsockopt(2)`.

### cgroups

`CGROUP_SOCK` and `CGROUP_SKB` can be used to load and use programs specific to a cgroup. `CGROUP_SOCK`  programs “run any time a process in the cgroup opens an AF_INET or AF_INET6 socket” and can be used to enable socket modifications. `CGROUP_SKB` programs are similar to `SOCKET_FILTER` and are executed for each network packet with the purpose of cgroup specific network filtering and accounting.

## Continuous integration

We have setup continuous integration and written about how we use [custom rkt stage1 images to test against various kernel versions](https://kinvolk.io/blog/2017/02/using-custom-rkt-stage1-images-to-test-against-various-kernel-versions/). At the time of writing, gobpf has elementary tests to verify that programs and their sections can be loaded on kernel versions `4.4`, `4.9` and `4.10` but no thorough testing of all functionality and features yet (e.g. perf map polling).

## Miscellaneous

* With Linux 4.12, [we have added a way to optionally specify the maximum number of active kretprobes](https://github.com/torvalds/linux/commit/696ced4fb1d76802f864d8848aa4716633f83c17) to avoid probe misses. gobpf users can set the maxiumum with [`EnableKprobe()`](https://github.com/iovisor/gobpf/pull/39/commits/5f20e2781bbe279f4d8f9f425799d836786d9077).
* `gobpf/pkg` now brings a couple of helper subpackages, for example `bpffs` to mount the BPF file system or `cpuonline` to detect all online CPUs.
* Numerous small improvements and bug fixes.

## Thanks to contributors and clients

In closing, we'd like to thank all those who have contributed to gobpf. We look forward to merging more commits from contributors and seeing how others make use of gopbf.

A special thanks goes to [Weaveworks](https://www.weave.works/) for funding [the work](https://www.weave.works/blog/improving-performance-reliability-weave-scope-ebpf/) from which gobpf was born. Continued contributions have been possible through other clients, for whom we are helping build products (WIP) that leverage gobpf.
