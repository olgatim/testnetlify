+++
description = "A look at how to build and use custom rkt stage1 images to test against various kernel versions on SemaphoreCI."
authors = ["Michael Schubert", "Chris Kühl"]
topics = ["rkt", "ebpf", "testing"]
tags = ["rkt", "ebpf", "gobpf", "SemaphoreCI", "Linux", "kernel", "testing", "Weave Scope"]
date = "2017-02-23T14:06:04+01:00"
title = "Using custom rkt stage1 images to test against various kernel versions"
draft = false
postImage =  "article-hero.jpg"

+++

## Introduction

When writing software that is tightly coupled with the Linux kernel, it is necessary to test on multiple versions of the kernel. This is relatively easy to do locally with VMs, but when working on open-source code hosted on Github, one wants to make these tests a part of the project’s continuous integration (CI) system to ensure that each pull request runs the tests and passes before merging.

Most CI systems run tests inside containers and, very sensibly, use various security mechanisms to restrict what the code being tested can access.  While this does not cause problems for most use cases, it does for us. It blocks certain syscalls that are needed to, say, test a container runtime like [rkt](https://github.com/coreos/rkt), or load ebpf programs into the kernel for testing, like we need to do to test [gobpf](https://github.com/iovisor/gobpf) and [tcptracer-bpf](https://github.com/weaveworks/tcptracer-bpf). It also doesn’t allow us to run virtual machines which we need to be able to do to run tests on different versions of the kernel.

### Finding a continuous integration service

While working on the rkt project, we did a survey of CI systems to find the ones that we could use to test rkt itself. Because of the above-stated requirements, it was clear that we needed one that gave us the option to run tests inside a virtual machine. This makes the list rather small; in fact, we were left with only [SemaphoreCI](https://semaphoreci.com/).

SemaphoreCI supports running Docker inside of the test environment. This is possible because the test environment they provide for this is simply a VM. For rkt, this allowed us to run automatic tests for the container runtime each time a PR was submitted and/or changed.

However, it doesn’t solve the problem of testing on various kernels and kernel configurations as we want for gobpf and tcptracer-bpf. Luckily, this is where rkt and its [KVM stage1](https://coreos.com/rkt/docs/latest/running-kvm-stage1.html) come to the rescue.

## Our solution

To continuously test the work we are doing on [Weave Scope](https://github.com/weaveworks/scope),
[tpctracer-bpf](https://github.com/waveworks/tcptracer-bpf) and [gobpf](https://github.com/iovisor/gobpf), we not only need a relatively new Linux kernel, but also require a subset of features like `CONFIG_BPF=y` or `CONFIG_HAVE_KPROBES=y` to be enabled.

With rkt's [KVM stage1](https://coreos.com/rkt/docs/latest/running-kvm-stage1.html) we can run our software in a virtual machine and, thanks to rkt's modular architecture, build and use [a custom stage1](https://coreos.com/rkt/docs/latest/subcommands/run.html#use-a-custom-stage1) suited to our needs. This allows us to run our tests on any platform that allows rkt to run; in our case, [Semaphore CI](https://semaphoreci.com/).

### Building a custom rkt stage1 for KVM

Our current approach relies on [App Container Image](https://github.com/appc/spec/blob/master/spec/aci.md) (ACI) dependencies. All of our custom stage1 images are based on rkt's `coreos.com/rkt/stage1-kvm`. In this way, we can apply changes to particular components (e.g. the Linux kernel) while reusing the other parts of the upstream stage1 image.

An [ACI manifest](https://github.com/appc/spec/blob/master/spec/aci.md#image-manifest) template for such an image could look like the following.

```json
{
        "acKind": "ImageManifest",
        "acVersion": "0.8.9",
        "name": "kinvolk.io/rkt/stage1-kvm-linux-{{kernel_version}}",
        "labels": [
                {
                        "name": "arch",
                        "value": "amd64"
                },
                {
                        "name": "os",
                        "value": "linux"
                },
                {
                        "name": "version",
                        "value": "0.1.0"
                }
        ],
        "annotations": [
                {
                        "name": "coreos.com/rkt/stage1/run",
                        "value": "/init"
                },
                {
                        "name": "coreos.com/rkt/stage1/enter",
                        "value": "/enter_kvm"
                },
                {
                        "name": "coreos.com/rkt/stage1/gc",
                        "value": "/gc"
                },
                {
                        "name": "coreos.com/rkt/stage1/stop",
                        "value": "/stop_kvm"
                },
                {
                        "name": "coreos.com/rkt/stage1/app/add",
                        "value": "/app-add"
                },
                {
                        "name": "coreos.com/rkt/stage1/app/rm",
                        "value": "/app-rm"
                },
                {
                        "name": "coreos.com/rkt/stage1/app/start",
                        "value": "/app-start"
                },
                {
                        "name": "coreos.com/rkt/stage1/app/stop",
                        "value": "/app-stop"
                },
                {
                        "name": "coreos.com/rkt/stage1/interface-version",
                        "value": "5"
                }
        ],
        "dependencies": [
                {
                        "imageName": "coreos.com/rkt/stage1-kvm",
                        "labels": [
                                {
                                        "name": "os",
                                        "value": "linux"
                                },
                                {
                                        "name": "arch",
                                        "value": "amd64"
                                },
                                {
                                        "name": "version",
                                        "value": "1.23.0"
                                }
                        ]
                }
        ]
}
```

__Note__: *[rkt doesn't automatically fetch stage1 dependencies](https://github.com/coreos/rkt/issues/2241) and we have to pre-fetch those manually.*

To build a kernel (`arch/x86/boot/bzImage`), we use `make bzImage` after applying a single patch to the source tree. Without the patch, the kernel would block and not return control to rkt.

```bash
# change directory to kernel source tree
curl -LsS https://github.com/coreos/rkt/blob/v1.23.0/stage1/usr_from_kvm/kernel/patches/0001-reboot.patch -O
patch --silent -p1 < 0001-reboot.patch
# configure kernel
make bzImage
```

We now can combine the ACI manifest with a root filesystem holding our custom built kernel, for example:

```bash
aci/4.9.4/
├── manifest
└── rootfs
    └── bzImage
```

We are now ready to build the stage1 ACI with [actool](https://github.com/appc/spec/releases/download/v0.8.9/appc-v0.8.9.tar.gz):

```bash
actool build --overwrite aci/4.9.4 my-custom-stage1-kvm.aci
```

### Run rkt with a custom stage1 for KVM

rkt offers [multiple command line flags](https://github.com/coreos/rkt/blob/master/Documentation/subcommands/run.md#use-a-custom-stage1) to be provided with a stage1; we use `--stage1-path=`. To smoke test our newly built stage1, we run a Debian Docker container and call `uname -r` so we make sure our custom built kernel is actually used:

```bash
rkt fetch image coreos.com/rkt/stage1-kvm:1.23.0 # due to rkt issue #2241
rkt run \
  --insecure-options=image \
  --stage1-path=./my-custom-stage1-kvm.aci \
  docker://debian --exec=/bin/uname -- -r
4.9.4-kinvolk-v1
[...]
```

We set `CONFIG_LOCALVERSION="-kinvolk-v1"` in the kernel config and the version is correctly shown as `4.9.4-kinvolk-v1`.

### Run on Semaphore CI

Semaphore does not include rkt by default on their platform. Hence, we have to download rkt in `semaphore.sh` as a first step:

```bash
#!/bin/bash

readonly rkt_version="1.23.0"

if [[ ! -f "./rkt/rkt" ]] || \
  [[ ! "$(./rkt/rkt version | awk '/rkt Version/{print $3}')" == "${rkt_version}" ]]; then

  curl -LsS "https://github.com/coreos/rkt/releases/download/v${rkt_version}/rkt-v${rkt_version}.tar.gz" \
    -o rkt.tgz

  mkdir -p rkt
  tar -xvf rkt.tgz -C rkt --strip-components=1
fi

[...]
```

After that we can pre-fetch the stage1 image we depend on and then run our tests. Note that we now use `./rkt/rkt`. And we use `timeout` to make sure our tests fail if they cannot be finished in a reasonable amount of time.

Example:

```bash
sudo ./rkt/rkt image fetch --insecure-options=image coreos.com/rkt/stage1-kvm:1.23.0
sudo timeout --foreground --kill-after=10 5m \
  ./rkt/rkt \
  --uuid-file-save=./rkt-uuid \
  --insecure-options=image,all-run \
  --stage1-path=./rkt/my-custom-stage1-kvm.aci \
  ...
  --exec=/bin/sh -- -c \
  'cd /go/... ; \
    go test -v ./...'
```

`--uuid-file-save=./rkt-uuid` is required to determine the UUID of the started container from `semaphore.sh` to read its exit status (since [it is not propagated on the KVM stage1](https://github.com/coreos/rkt/issues/2777)) after the test finished and exit accordingly:

```bash
[...]

test_status=$(sudo ./rkt/rkt status $(<rkt-uuid) | awk '/app-/{split($0,a,"=")} END{print a[2]}')
exit $test_status
```

### Bind mount directories from stage1 into stage2

If you want to provide data to stage2 from stage1 you can do this with a small systemd drop-in unit to bind mount the directories. This allows you to add or modify content without actually touching the stage2 root filesystem.

We did the following to provide the Linux kernel headers to stage2:

```bash
# add systemd drop-in to bind mount kernel headers
mkdir -p "${rootfs_dir}/etc/systemd/system/prepare-app@.service.d"
cat <<EOF >"${rootfs_dir}/etc/systemd/system/prepare-app@.service.d/10-bind-mount-kernel-header.conf"
[Service]
ExecStartPost=/usr/bin/mkdir -p %I/${kernel_header_dir}
ExecStartPost=/usr/bin/mount --bind "${kernel_header_dir}" %I/${kernel_header_dir}
EOF
```

__Note__: for this to work you need to have `mkdir` in stage1, which is not included in the default rkt stage1-kvm. We use the one from busybox: https://busybox.net/downloads/binaries/1.26.2-i686/busybox_MKDIR

### Automating the steps

We want to be able to do this for many kernel versions. Thus, we have created a tool, [stage1-builder](https://github.com/kinvolk/stage1-builder), that does most of this for us. With [stage1-builder](https://github.com/kinvolk/stage1-builder) you simply need to add the kernel configuration to the `config` directory and run the `./builder` script. The result is an ACI file containing our custom kernel with a dependency on the upstream kvm-stage1.

## Conclusion

With SemaphoreCI providing us with a proper VM and rkt’s modular stage1 architecture, we have put together a CI pipeline that allows us to test gobpf and tcptracer-bpf on various kernels. In our opinion this setup is much preferable to the alternative, setting up and maintaining Jenkins.

Interesting to point out is that we did not have to use or make changes to rkt’s build system. Leveraging ACI dependencies was all we needed to swap out the KVM stage1 kernel. For the simple case of testing software on various kernel versions, rkt’s modular design has proven to be very useful.
