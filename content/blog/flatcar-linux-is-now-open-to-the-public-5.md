---
title: "Flatcar Linux is now open to the public 5"
subtitle: A composable Kubernetes distribution for on-premise, cloud, and hybrid environments.
date: 2018-12-20T12:14:20+02:00
draft: false
description: Just before the All Systems Go! conference, we had a BPF Hackfest at the Kinvolk office and one of the topics of discussion was to document different BPF ELF loaders. This blog post is the result of it.
filterType: all
image: post-5.jpg
author: Chris Kühl
authorPosition: "CEO & co-founder"
socials: [
  {
    title: "github",
    link: "https://github.com/blixtra"
  },
  {
    title: "linkedin",
    link: "https://www.linkedin.com/in/christopherk1"
  },
  {
  title: "twitter",
  link: "https://www.linkedin.com/in/blixtra"
  }
]
authorImage: post-main-author.jpg
---

Just before the All Systems Go! conference, we had a BPF Hackfest at the Kinvolk office and one of the topics of discussion was to document different BPF ELF loaders. This blog post is the result of it.

BPF is a new technology in the Linux kernel, which allows running custom code attached to kernel functions, network cards, or sockets amongst others. Since it is very versatile a plethora of tools can be used to work with BPF code: perf record, tc from iproute2, libbcc,etc. Each of these tools has a different focus, but they use the same Linux facilities to achieve their goals. This post documents the steps they use to load BPF into the kernel.

### Common steps

BPF is usually compiled from C, using clang, and “linked” into a single ELF file. The exact format of the ELF file depends on the specific tool, but there are some common points. ELF sections are used to distinguish map definitions and executable code. Each code section usually contains a single, fully inlined function.

<div class="post-image">
  <img src="/images/posts/post-image.jpg" alt="post image">
  <div class="post-image__author">Photo: Barcroft Media/Getty</div>
</div>

<div class="other-news-block">
  {{< aside >}}
  <div class="other-news-block__text">
    <p>The loader creates maps from the definition in the ELF using the bpf(BPF_MAP_CREATE) syscall and saves the returned file descriptors [1]. This is where the first complication comes in, because the loader now has to rewrite all references to a particular map with the file descriptor returned by the bpf() syscall. It does this by iterating through the symbol and relocation tables contained in the ELF, which yields an offset into a code section. It then patches the instruction at that offset to use the correct fd [2].</p>
    <p>After this fixup is done, the loader uses bpf(BPF_PROG_LOAD) with the patched bytecode [3]. The BPF verifier resolves map fds to the in-kernel data structure, and verifies that the code is using the maps correctly. The kernel rejects the code if it references invalid file descriptors. This means that the outcome of BPF_PROG_LOAD depends on the environment of the calling process.</p>
    <p>After the BPF program is successfully loaded, it can be attached to a variety of kernel subsystems [4]. Some subsystems use a simple syscall (e.g. SO_ATTACH), while others require netlink messages (XDP) or manipulating the tracefs (kprobes, tracepoints).</p>
  </div>
</div>

> Every time I mentioned the fact that establishment press should advocate for Assange’s rights, I heard hoots of laughter.

### Small differences between BPF ELF loaders

The different loaders offer different features and for that reason use slightly different conventions in the ELF file. The ELF conventions are not part of the Linux ABI. It means that an ELF file prepared for one loader usually cannot just be loaded by another one. The map definition struct (struct bpf_elf_map in the schema) is the main varying part.

### Conclusion

BPF is actively developed in the Linux kernel and whenever a new feature is implemented, BPF ELF loader might need an update as well to support it. The different BPF ELF loaders have different focuses and might not add support of all BPF kernel new features at the same speed. There are efforts underway to standardise on libbpf as the canonical implementation. The plan is to ship libbpf with the kernel, which means it will set the de-facto standard for user space BPF support.

