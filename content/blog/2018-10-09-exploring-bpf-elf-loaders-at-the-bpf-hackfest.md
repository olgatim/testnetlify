+++
authors = ["Lorenz Bauer, Alban Crequy"]
date = "2018-10-09T17:00:00+02:00"
description = "Documenting BPF ELF Loaders at the BPF Hackfest"
draft = false
tags = ["ebpf", "hackfest"]
title = "Exploring BPF ELF Loaders at the BPF Hackfest"
topics = ["blog", "ebpf", "hackfest"]
postImage =  "bpf-hackfest-photo.jpg"
+++

Just before the All Systems Go! conference, we had a BPF Hackfest at the Kinvolk office and one of the topics of discussion was to document different BPF ELF loaders. This blog post is the result of it.

BPF is a new technology in the Linux kernel, which allows running custom code
attached to kernel functions, network cards, or sockets amongst others. Since
it is very versatile a plethora of tools can be used to work with BPF code:
perf record, tc from iproute2, libbcc, etc. Each of these tools has a different
focus, but they use the same Linux facilities to achieve their goals. This post
documents the steps they use to load BPF into the kernel.

## Common steps

BPF is usually compiled from C, using clang, and “linked” into a single ELF
file. The exact format of the ELF file depends on the specific tool, but there
are some common points. ELF sections are used to distinguish map definitions
and executable code. Each code section usually contains a single, fully inlined
function.

<figure class="img-fluid">
	<img src="/media/bpf-elf-loader.png" class="img-fluid">
</figure>

The loader creates maps from the definition in the ELF using the
`bpf(BPF_MAP_CREATE)` syscall and saves the returned file descriptors [1]. This
is where the first complication comes in, because the loader now has to rewrite
all references to a particular map with the file descriptor returned by the
`bpf()` syscall. It does this by iterating through the symbol and relocation
tables contained in the ELF, which yields an offset into a code section. It
then patches the instruction at that offset to use the correct fd [2].


After this fixup is done, the loader uses `bpf(BPF_PROG_LOAD)` with the patched
bytecode [3]. The BPF verifier resolves map fds to the in-kernel data
structure, and verifies that the code is using the maps correctly. The kernel
rejects the code if it references invalid file descriptors. This means that the
outcome of `BPF_PROG_LOAD` depends on the environment of the calling process.


After the BPF program is successfully loaded, it can be attached to a variety
of kernel subsystems [4]. Some subsystems use a simple syscall (e.g.
`SO_ATTACH`), while others require netlink messages (XDP) or manipulating the
tracefs (kprobes, tracepoints).


## Small differences between BPF ELF loaders

The different loaders offer different features and for that reason use slightly
different conventions in the ELF file. The ELF conventions are not part of the
Linux ABI. It means that an ELF file prepared for one loader usually cannot
just be loaded by another one. The map definition struct (`struct bpf_elf_map`
in the schema) is the main varying part.

| BPF ELF loader \ Features                                                                                                   | Maps in maps                                                                                   | Pinning                                                                                                     | NUMA node                                                                                        | [bpf2bpf function call](https://github.com/torvalds/linux/commit/cc8b0b92a1699bc32f7fec71daa2bfc90de43a4d)              |
|-----------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------|
| libbpf (Linux kernel) [map def](https://github.com/torvalds/linux/blob/v4.16/samples/bpf/bpf_load.h#L10-L18)                | no                                                                                             | no                                                                                                          | Yes (via [samples](https://github.com/torvalds/linux/blob/v4.18/samples/bpf/bpf_load.h#L10-L18)) | [Yes](https://github.com/torvalds/linux/commit/48cca7e44f9f8268fdcd4351e2f19ff2275119d1)                                |
| Perf [map def](https://github.com/torvalds/linux/blob/v4.18/tools/lib/bpf/libbpf.h#L214-L220)                               | no                                                                                             | no                                                                                                          | no                                                                                               | yes                                                                                                                     |
| iproute2 / tc [map def](https://git.kernel.org/pub/scm/network/iproute2/iproute2.git/tree/include/bpf_elf.h#n32)            | [yes](https://git.kernel.org/pub/scm/network/iproute2/iproute2.git/tree/include/bpf_elf.h#n26) | Yes (none, object, global)                                                                                  | no                                                                                               | [Yes](https://git.kernel.org/pub/scm/network/iproute2/iproute2.git/commit/?id=b5cb33aec65cb77183abbdfa5b61ecc9877ec776) |
| gobpf [map def](https://github.com/iovisor/gobpf/blob/de8c86d02193b02067206aae25dde87d2ac78245/elf/include/bpf.h#L610-L618) | [Not yet](https://github.com/iovisor/gobpf/issues/120)                                         | Yes (none, object, global, [custom](https://github.com/iovisor/gobpf/blob/master/Documentation/pinning.md)) | no                                                                                               | no                                                                                                                      |
| newtools/ebpf                                                                                                               | yes                                                                                            | no                                                                                                          | no                                                                                               | yes                                                                                                                     |

There are other varying parts in loader ELF conventions that we found noteworthy:
- Some use one ELF section per map, some use one “maps” sections for all the maps.
- The naming of the sections and the function entrypoint vary. Some have default section names that can be overriden in the CLI (tc), some requires well-defined prefixes (“kprobe”, “kretprobes/”).
- Some use csv-style parameters in the section name ([perf](http://www.brendangregg.com/perf.html#eBPF)), some give an [API in Go](https://github.com/iovisor/gobpf/blob/5d6a7a7/elf/elf.go#L468-L476) to programatically change the loader’s behaviour.

## Conclusion

BPF is actively developed in the Linux kernel and whenever a new feature is implemented, BPF ELF loader might need an update as well to support it. The different BPF ELF loaders have different focuses and might not add support of all BPF kernel new features at the same speed. There are efforts underway to standardise on libbpf as the canonical implementation. The plan is to ship libbpf with the kernel, which means it will set the de-facto standard for user space BPF support.


