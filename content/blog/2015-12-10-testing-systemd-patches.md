+++
topics = ["Development", "Tools"]
date = "2015-12-10T16:45:41+01:00"
description = "An approach to testing your systemd patches efficiently"
draft = false
authors = ["Alban Crequy"]
tags = ["linux", "systemd", "testing"]
title = "Testing systemd Patches"
postImage =  "article-hero.jpg"
+++

It’s not so easy to test new patches for systemd. Because systemd is the first process started on boot, the traditional way to test was to install the new version on your own computer and reboot. However, this approach is not practical because it makes the development cycle quite long: after writing a few lines of code, I don’t want to close all my applications and reboot. There is also a risk that my patch contains some bugs and if I install systemd on my development computer, it won’t boot. It would then take even more time to fix it. All of this probably just to test a few lines of code.

This is of course not a new problem and systemd-nspawn was at first implemented in 2011 as a simple tool to test systemd in an isolated environment. During the years, systemd-nspawn grew in features and became more than a testing tool. Today, it is integrated with other components of the systemd project such as machinectl and it can pull container images or VM images, start them as systemd units. systemd-nspawn is also used as an internal component of the app container runtime, [rkt](https://github.com/coreos/rkt).

When developing rkt, I often need to test patches in systemd-nspawn or other components of the systemd project like systemd-machined. And since systemd-nspawn uses recent features of the Linux kernel that are still being developed (cgroups, user namespaces, etc.), I also sometimes need to test a different kernel or a different machined. In this case, testing with systemd-nspawn does not help because I would still use the kernel installed on my computer and systemd-machined installed on my computer.

I still don’t want to reboot nor do I want to install a non-stable kernel or non-stable systemd patches on my development computer. So today I am explaining how I am testing new kernels and new systemd with kvmtool and debootstrap.

## Getting kvmtool

Why kvmtool? I want to be able to install systemd in my test environment easily with just a “make install”. I don’t want to have to prepare a testing image for each test but instead just use the same filesystem.

```
$ cd ~/git
$ git clone https://kernel.googlesource.com/pub/scm/linux/kernel/git/will/kvmtool
$ cd kvmtool && make
```

## Compiling a kernel

The kernel is compiled as usual but with the options listed in [kvmtool’s README file](https://kernel.googlesource.com/pub/scm/linux/kernel/git/will/kvmtool/+/master/README) (here's the [.config file](https://gist.github.com/alban/898a412f28125850c0ba) I use).
I just keep around the different versions of the kernels I want to test:

```
$ cd ~/git/linux
$ ls bzImage*
bzImage      bzImage-4.3         bzImage-cgroupns.v5  bzImage-v4.1-rc1-2-g1b852bc
bzImage-4.1  bzImage-4.3.0-rc4+  bzImage-v4.1-rc1     bzImage-v4.3-rc4-15-gf670268
```

## Getting the filesystem for the test environment

The [man page of systemd-nspawn](http://www.freedesktop.org/software/systemd/man/systemd-nspawn.html) explains how to install a minimal Fedora, Debian or Arch distribution in a directory with the `dnf`, `debootstrap` or `pacstrap` commands respectively.

```
sudo dnf -y --releasever=22 --nogpg --installroot=${HOME}/distro-trees/fedora-22 --disablerepo='*' --enablerepo=fedora install systemd passwd dnf fedora-release vim-minimal
```

Set the root password of your fedora 22 the first time, and then you are ready to boot it:

```
sudo systemd-nspawn -D ${HOME}/distro-trees/fedora-22 passwd
```

I don’t have to actually boot it with kvmtool to update the system. `systemd-nspawn` is enough:

```
sudo systemd-nspawn -D ${HOME}/distro-trees/fedora-22 dnf update
```

## Installing systemd

```
$ cd ~/git/systemd
$ ./autogen.sh
$ ./configure CFLAGS='-g -O0 -ftrapv' --enable-compat-libs --enable-kdbus --sysconfdir=/etc --localstatedir=/var --libdir=/usr/lib64
$ make
$ sudo DESTDIR=$HOME/distro-trees/fedora-22 make install
$ sudo DESTDIR=$HOME/distro-trees/fedora-22/fedora-tree make install
```

As you notice, I am installing systemd both in `~/distro-trees/fedora-22` and `~/distro-trees/fedora-22/fedora-tree`. The first one is for the VM started by `kvmtool`, and the second is for the container started by `systemd-nspawn` inside the VM.

## Running a test

I can easily test my systemd patches quickly with various versions of the kernel and various Linux distributions. I can also start systemd-nspawn inside lkvm if I want to test the interaction between systemd, systemd-machined and systemd-nspawn. All of this, without rebooting or installing any unstable software on my main computer.

I am sourcing the following in my shell:
```bash
test_kvm() {
        distro=$1
        kernelver=$2
        kernelparams=$3

        kernelimg=${HOME}/git/linux/bzImage-${kernelver}
        distrodir=${HOME}/distro-trees/${distro}

        if [ ! -f $kernelimg -o ! -d $distrodir ] ; then
                echo "Usage: test_kvm distro kernelver kernelparams"
                echo "       test_kvm f22 4.3 systemd.unified_cgroup_hierarchy=1"
                return 1
        fi

        sudo ${HOME}/git/kvmtool/lkvm run --name ${distro}-${kernelver} \
                --kernel ${kernelimg} \
                --disk ${distrodir} \
                --mem 2048 \
                --network virtio \
                --params="${kernelparams}"
}
```

Then, I can just test rkt or systemd-nspawn with the unified cgroup hierarchy:
```
$ test_kvm fedora-22 4.3 systemd.unified_cgroup_hierarchy=1
```

## Conclusion


With this setup, I could test cgroup namespaces in `systemd-nspawn` with the [kernel patches](http://lists.linuxfoundation.org/pipermail/containers/2015-December/036448.html) that are being reviewed upstream and [my systemd patches](https://github.com/systemd/systemd/pull/2112) without rebooting or installing them on my development computer.
