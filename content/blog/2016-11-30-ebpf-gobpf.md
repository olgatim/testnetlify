+++
authors = ["Michael Schubert"]
date = "2016-11-30T19:04:00+01:00"
description = "An introduction to eBPF and gobpf"
draft = false
tags = ["ebpf", "gobpf", "golang"]
title = "Introducing gobpf - Using eBPF from Go"
topics = ["ebpf", "gobpf", "golang"]
postImage =  "gopher-plus-bcc.svg"

+++

## What is eBPF?

eBPF is a "bytecode virtual machine" in the Linux kernel that is used for
tracing kernel functions, networking, performance analysis and more. Its roots
lay in the [Berkley Packet Filter](https://www.kernel.org/doc/Documentation/networking/filter.txt)
(sometimes called LSF, Linux Socket Filtering), but as it supports more
operations (e.g. `BPF_CALL  0x80  /* eBPF only: function call */`) and nowadays
has much broader use than packet filtering on a socket, it's called extended
BPF.

With the addition of the dedicated `bpf()` syscall in Linux 3.18, it became
easier to perform the various eBPF operations. Further, the [BPF
compiler collection](https://github.com/iovisor/bcc) from the [IO Visor Project](https://www.iovisor.org) and its libbpf
provide a rich set of helper functions as well as Python bindings that make it
more convenient to write eBPF powered tools.

To get an idea of how eBPF looks, let's take a peek at `struct bpf_insn prog[]`
- a list of instructions in pseudo-assembly. Below we have a simple user-space
C program to count the number of [fchownat(2)](http://man7.org/linux/man-pages/man2/lchown.2.html) calls. We use
`bpf_prog_load` from libbpf to load the eBPF instructions as a
[kprobe](https://www.kernel.org/doc/Documentation/kprobes.txt) and use
`bpf_attach_kprobe` to attach it to the syscall. Now each time `fchownat` is
called, the kernel executes the eBPF program. The program loads the map (more
about maps later), increments the counter and exits. In the C program, we read
the value from the map and print it every second.


```c
#include <errno.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>

#include <linux/version.h>

#include <bcc/bpf_common.h>
#include <bcc/libbpf.h>

int main() {
	int map_fd, prog_fd, key=0, ret;
	long long value;
	char log_buf[8192];
	void *kprobe;

	/* Map size is 1 since we store only one value, the chown count */
	map_fd = bpf_create_map(BPF_MAP_TYPE_HASH, sizeof(key), sizeof(value), 1);
	if (map_fd < 0) {
		fprintf(stderr, "failed to create map: %s (ret %d)\n", strerror(errno), map_fd);
		return 1;
	}

	ret = bpf_update_elem(map_fd, &key, &value, 0);
	if (ret != 0) {
		fprintf(stderr, "failed to initialize map: %s (ret %d)\n", strerror(errno), ret);
		return 1;
	}

	struct bpf_insn prog[] = {
		/* Put 0 (the map key) on the stack */
		BPF_ST_MEM(BPF_W, BPF_REG_10, -4, 0),
		/* Put frame pointer into R2 */
		BPF_MOV64_REG(BPF_REG_2, BPF_REG_10),
		/* Decrement pointer by four */
		BPF_ALU64_IMM(BPF_ADD, BPF_REG_2, -4),
		/* Put map_fd into R1 */
		BPF_LD_MAP_FD(BPF_REG_1, map_fd),
		/* Load current count from map into R0 */
		BPF_RAW_INSN(BPF_JMP | BPF_CALL, 0, 0, 0,
			     BPF_FUNC_map_lookup_elem),
		/* If returned value NULL, skip two instructions and return */
		BPF_JMP_IMM(BPF_JEQ, BPF_REG_0, 0, 2),
		/* Put 1 into R1 */
		BPF_MOV64_IMM(BPF_REG_1, 1),
		/* Increment value by 1 */
		BPF_RAW_INSN(BPF_STX | BPF_XADD | BPF_DW, BPF_REG_0, BPF_REG_1, 0, 0),
		/* Return from program */
		BPF_EXIT_INSN(),
	};

	prog_fd = bpf_prog_load(BPF_PROG_TYPE_KPROBE, prog, sizeof(prog), "GPL", LINUX_VERSION_CODE, log_buf, sizeof(log_buf));
	if (prog_fd < 0) {
		fprintf(stderr, "failed to load prog: %s (ret %d)\ngot CAP_SYS_ADMIN?\n%s\n", strerror(errno), prog_fd, log_buf);
		return 1;
	}

	kprobe = bpf_attach_kprobe(prog_fd, "p_sys_fchownat", "p:kprobes/p_sys_fchownat sys_fchownat", -1, 0, -1, NULL, NULL);
	if (kprobe == NULL) {
		fprintf(stderr, "failed to attach kprobe: %s\n", strerror(errno));
		return 1;
	}

	for (;;) {
		ret = bpf_lookup_elem(map_fd, &key, &value);
		if (ret != 0) {
			fprintf(stderr, "failed to lookup element: %s (ret %d)\n", strerror(errno), ret);
		} else {
			printf("fchownat(2) count: %lld\n", value);
		}
		sleep(1);
	}

	return 0;
}
```

The example requires libbcc and can be compiled with:

```bash
gcc -I/usr/include/bcc/compat main.c -o chowncount -lbcc
```

__Nota bene__: *the increment in the example code is not atomic. In real code, we
would have to use one map per CPU and aggregate the result.*

It is important to know that eBPF programs run directly in the kernel and that
their invocation depends on the type. They are executed without change of
context. As we have seen above, kprobes for example are triggered whenever the kernel executes a
specified function.

Thanks to [clang](http://clang.llvm.org/) and [LLVM](http://llvm.org/), it's
not necessary to actually write plain eBPF instructions. Modules can be
written in C and use functions provided by libbpf (as we will see in the gobpf
example below).


## eBPF Program Types

The type of an eBPF program defines properties like the kernel helper functions
available to the program or the input it receives from the kernel. Linux 4.8
knows the following program types:

```c
// https://github.com/torvalds/linux/blob/v4.8/include/uapi/linux/bpf.h#L90-L98
enum bpf_prog_type {
	BPF_PROG_TYPE_UNSPEC,
	BPF_PROG_TYPE_SOCKET_FILTER,
	BPF_PROG_TYPE_KPROBE,
	BPF_PROG_TYPE_SCHED_CLS,
	BPF_PROG_TYPE_SCHED_ACT,
	BPF_PROG_TYPE_TRACEPOINT,
	BPF_PROG_TYPE_XDP,
};
```

A program of type `BPF_PROG_TYPE_SOCKET_FILTER`, for instance, receives a [`struct
__sk_buff *`](https://github.com/torvalds/linux/blob/v4.8/include/uapi/linux/bpf.h#L418-L439)
as its first argument whereas it's [`struct pt_regs *`](https://github.com/torvalds/linux/blob/v4.8/arch/x86/include/uapi/asm/ptrace.h#L43-L76)
for programs of type `BPF_PROG_TYPE_KPROBE`.



## eBPF Maps

Maps are a "generic data structure for storage of different types of data" and
can be used to share data between eBPF programs as well as between kernel and
userspace. The `key` and `value` of a map can be of arbitrary size as defined when
creating the map. The user also defines the maximum number of entries
(`max_entries`). Linux 4.8 knows the following map types:

```c
// https://github.com/torvalds/linux/blob/v4.8/include/uapi/linux/bpf.h#L78-L88
enum bpf_map_type {
	BPF_MAP_TYPE_UNSPEC,
	BPF_MAP_TYPE_HASH,
	BPF_MAP_TYPE_ARRAY,
	BPF_MAP_TYPE_PROG_ARRAY,
	BPF_MAP_TYPE_PERF_EVENT_ARRAY,
	BPF_MAP_TYPE_PERCPU_HASH,
	BPF_MAP_TYPE_PERCPU_ARRAY,
	BPF_MAP_TYPE_STACK_TRACE,
	BPF_MAP_TYPE_CGROUP_ARRAY,
};
```

While `BPF_MAP_TYPE_HASH` and `BPF_MAP_TYPE_ARRAY` are generic maps for
different types of data, `BPF_MAP_TYPE_PROG_ARRAY` is a special purpose array
map. It holds file descriptors referring to other eBPF programs and can be used
by an eBPF program to "replace its own program flow with the one from the
program at the given program array slot". The `BPF_MAP_TYPE_PERF_EVENT_ARRAY`
map is for storing a data of type `struct perf_event` in a ring buffer.

In the example above we used a map of type hash with a size of 1 to hold the
call counter.


## gobpf

In the context of the work we are doing on [Weave
Scope](https://github.com/weaveworks/scope) for
[Weaveworks](https://www.weave.works/), we have been working extensively with
both eBPF and Go. As Scope is written in Go, it makes sense to use eBPF
directly from Go.

In looking at how to do this, we stumbled upon [some
code](https://github.com/iovisor/iomodules/tree/master/hover/bpf) in the IO
Visor Project that looked like a good starting point. After talking to the
folks at the project, we decided to move this out into a dedicated repository:
https://github.com/iovisor/gobpf gobpf is a Go library that leverages the bcc
project to make working with eBPF programs from Go simple.

To get an idea of how this works, the following example `chrootsnoop` shows how
to use a `bpf.PerfMap` to monitor [chroot(2)](http://man7.org/linux/man-pages/man2/chroot.2.html)
calls:

```go
package main

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"os"
	"os/signal"
	"unsafe"

	"github.com/iovisor/gobpf"
)

import "C"

const source string = `
#include <uapi/linux/ptrace.h>
#include <bcc/proto.h>

typedef struct {
	u32 pid;
	char comm[128];
	char filename[128];
} chroot_event_t;

BPF_PERF_OUTPUT(chroot_events);

int kprobe__sys_chroot(struct pt_regs *ctx, const char *filename)
{
	u64 pid = bpf_get_current_pid_tgid();
	chroot_event_t event = {
		.pid = pid >> 32,
	};
	bpf_get_current_comm(&event.comm, sizeof(event.comm));
	bpf_probe_read(&event.filename, sizeof(event.filename), (void *)filename);
	chroot_events.perf_submit(ctx, &event, sizeof(event));
	return 0;
}
`

type chrootEvent struct {
	Pid      uint32
	Comm     [128]byte
	Filename [128]byte
}

func main() {
	m := bpf.NewBpfModule(source, []string{})
	defer m.Close()

	chrootKprobe, err := m.LoadKprobe("kprobe__sys_chroot")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to load kprobe__sys_chroot: %s\n", err)
		os.Exit(1)
	}

	err = m.AttachKprobe("sys_chroot", chrootKprobe)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to attach kprobe__sys_chroot: %s\n", err)
		os.Exit(1)
	}

	chrootEventsTable := bpf.NewBpfTable(0, m)

	chrootEventsChannel := make(chan []byte)

	chrootPerfMap, err := bpf.InitPerfMap(chrootEventsTable, chrootEventsChannel)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to init perf map: %s\n", err)
		os.Exit(1)
	}

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt, os.Kill)

	go func() {
		var chrootE chrootEvent
		for {
			data := <-chrootEventsChannel
			err := binary.Read(bytes.NewBuffer(data), binary.LittleEndian, &chrootE)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Failed to decode received chroot event data: %s\n", err)
				continue
			}
			comm := (*C.char)(unsafe.Pointer(&chrootE.Comm))
			filename := (*C.char)(unsafe.Pointer(&chrootE.Filename))
			fmt.Printf("pid %d %s called chroot(2) on %s\n", chrootE.Pid, C.GoString(comm), C.GoString(filename))
		}
	}()

	chrootPerfMap.Start()
	<-sig
	chrootPerfMap.Stop()
}
```

You will notice that our eBPF program is written in C for this example. The bcc
project uses clang to convert the code to eBPF instructions.

We don't have to interact with libbpf directly from our Go code, as gobpf
implements a callback and makes sure we receive the data from our eBPF program
through the `chrootEventsChannel`.

To test the example, you can run it with `sudo -E go run chrootsnoop.go` and
for instance execute any systemd unit with `RootDirectory` statement. A simple
`chroot ...` also works, of course.

```ini
# hello.service
[Unit]
Description=hello service

[Service]
RootDirectory=/tmp/chroot
ExecStart=/hello

[Install]
WantedBy=default.target
```

You should see output like:

```bash
pid 7857 (hello) called chroot(2) on /tmp/chroot
```


## Conclusion

With its growing [capabilities](https://github.com/iovisor/bcc/blob/master/docs/kernel-versions.md#bpf-features-by-linux-kernel-version),
eBPF has become an indispensable tool for modern Linux system software. gobpf
helps you to conveniently use libbpf functionality from Go.

gobpf is in a very early stage, but usable. Input and contributions are very much welcome.

If you want to learn more about our use of eBPF in software like [Weave
Scope](https://github.com/weaveworks/scope), stay tuned and have a look at our
work on GitHub: https://github.com/kinvolk

Follow [Kinvolk on Twitter](https://twitter.com/kinvolkio) to get notified when
new blog posts go live.
