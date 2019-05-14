+++
authors = ["Alban Crequy"]
date = "2018-04-25T13:00:00+02:00"
description = "Kinvolk announces Flatcar Linux, a fork of Container Linux"
draft = false
tags = ["linux", "containers", "build", "rootless", "unprivileged"]
title = "Towards unprivileged container builds"
topics = ["linux", "containers"]
postImage =  "article-hero.jpg"
+++

<figure class="img-fluid">
	<img src="/media/thomas-peham-435981-unsplash.jpg" class="img-fluid">
</figure>

Once upon a time, software was built and installed with the classic triptych `./configure`, `make`, `make install`. The build part with `make` didn’t need to be run as root, which was, in fact, discouraged.

Later, software started being distributed through package managers and built with `rpm` or `dpkg-buildpackage`. Building packages as root was still unnecessary and discouraged. Since `rpm` or `deb` packages are just archive files, there shouldn’t be any need for privileged operations to build them. After all, we don’t need the ability to load a kernel module or reconfigure the network to create an archive file.

Why should we avoid building software as root? First, to avoid potential collateral damage to the developer’s machine. Second, to avoid being compromised by potentially untrusted resources. This is especially important for build services where anyone can submit a build job: the administrators of the build service have to protect their services against potentially malicious build submissions.

Nowadays, more and more software in cloud infrastructure is built and distributed as container images. Whether it is a Docker image, an [OCI bundle](https://github.com/opencontainers/runtime-spec/blob/master/bundle.md), [ACI](https://github.com/appc/spec) or another format, this is not so different from an archive file. And yet, the majority of container images are built via a [`Dockerfile`](https://docs.docker.com/engine/reference/builder/) with the Docker Engine, which, along with most of its operations, mostly runs as root.

This makes life difficult for build services that want to offer container builds to users that are not necessarily trusted. How did we dig ourselves into this hole?

## Why does `docker build` need root?

There are two reasons why docker build needs root: the build command requires root for some images and to setup the build container.

### Run commands with privileges

Dockerfiles allow executing arbitrary commands inside the container environment that it is building with the “RUN” command. This makes the build very convenient: users can use “apt” on Ubuntu based images to install additional packages and they will not be installed on the host but in the container that is being built. This alone requires root access in the container because “apt” will need to install files in directories that are only writable by root.
### Starting the build container
To be able to execute those “RUN” commands in the container, “docker build” needs to start this build container first. To start any container, Docker needs to perform the following privileged operations, among others:

* Preparing an overlay filesystem. This is necessary to keep track of the changes compared to the base image and requires `CAP_SYS_ADMIN` to mount.
* Creating new Linux namespaces (sometimes called “unsharing”): mount namespace, pid namespace, etc. All of them (except one, we will see below) require the `CAP_SYS_ADMIN` capability.
* `pivot_root` or `chroot`, which also require `CAP_SYS_ADMIN` or `CAP_SYS_CHROOT`.
* Mounting basic filesystems like `/proc`. The “RUN” command can execute arbitrary shell scripts, which often require a properly set up `/proc`.
* Preparing basic device nodes like `/dev/null`, `/dev/zero`. This is also necessary for a lot of shell scripts. Depending on how they are prepared, this requires either `CAP_MKNOD` or `CAP_SYS_ADMIN`.

Only root can perform these operations:

| Operation                       | Capability required         | Without root? |
|---------------------------------|-----------------------------|:-------------:|
| Mount a new overlayfs           | CAP_SYS_ADMIN               | ❌            |
| Create new (non-user) namespace | CAP_SYS_ADMIN               | ❌            |
| Chroot or pivot_root            | CAP_CHROOT or CAP_SYS_ADMIN | ❌            |
| Mount a new procfs              | CAP_SYS_ADMIN               | ❌            |
| Prepare basic device nodes      | CAP_MKNOD or CAP_SYS_ADMIN  | ❌            |

This blog post will focus on some of those operations in detail. This is not an exhaustive list. For example, preparing basic device nodes is not covered in this blog post.
## Projects similar to docker-build
There are other projects to build docker containers that aim to be unprivileged. Some want to support builds from a Dockerfile.

* [img](https://github.com/genuinetools/img): Standalone, daemon-less, unprivileged Dockerfile and OCI compatible container image builder.
* [buildah](https://github.com/projectatomic/buildah): A tool that facilitates building OCI images
* [kaniko](https://cloudplatform.googleblog.com/2018/04/introducing-kaniko-Build-container-images-in-Kubernetes-and-Google-Container-Builder-even-without-root-access.html)
* [orca-build](https://github.com/cyphar/orca-build)

They could be a building block for CI services or serverless frameworks which need to build a container image for each function.

<figure class="img-fluid w-75 mx-auto">
        <img src="/media/unprivileged-builds-kubernetes.svg" class="img-fluid">
</figure>

## Where user namespaces come into play
In the same way that other Linux namespaces restrict the visibility of resources to processes inside the namespace, processes in user namespaces only see a subset of all possible users and groups. In the initial user namespace, there are approximately 4294967296 (2^32) possible users. The range goes from 0, for the superuser or root, to 2^32-1.

### uid mappings

<figure class="img-fluid w-75 mx-auto">
        <img src="/media/unprivileged-builds-userns1.svg" class="img-fluid">
</figure>

When setting up a user namespace, container runtimes allocate a range of uids and specify a uid mapping. The mapping means that uid 0 (root) in the container could be mapped to uid 100000 on the host. Root being relative means that capabilities are always relative to a specific user namespace. We will come back to that.

### Nested user namespaces

User namespaces can be nested. The inner namespace will have the same amount (or, usually, fewer) uids than the outer namespace. Not all uids from the outer namespace are mapped, but those which are are mapped in a bijective, one-to-one way.

<figure class="img-fluid w-75 mx-auto">
        <img src="/media/unprivileged-builds-userns2.svg" class="img-fluid">
</figure>

### Unprivileged user namespaces
As opposed to all other kinds of Linux namespaces, user namespaces can be created by an unprivileged user (without `CAP_SYS_ADMIN`). In this case, the uid mapping is restricted to a single uid. In the example below, uid 1000 on the host is mapped to root (uid 0) in the yellow container.

<figure class="img-fluid w-75 mx-auto">
        <img src="/media/unprivileged-builds-userns3.svg" class="img-fluid">
</figure>

Once the new unprivileged user namespace is created, the process inside is root from the point of view of the container and therefore it has `CAP_SYS_ADMIN`, so it could create other kinds of namespaces.

This is a useful building block for our goal of unprivileged container builds.

| Operation                       | Capability required         | Without root? |
|---------------------------------|-----------------------------|:-------------:|
| Mount a new overlayfs           | CAP_SYS_ADMIN               | ❌            |
| Create new user namespace       | No capability required (*)  | ✅            |
| Create new (non-user) namespace | CAP_SYS_ADMIN               | ✅            |
| Chroot or pivot_root            | CAP_CHROOT or CAP_SYS_ADMIN | ❌            |
| Mount a new procfs              | CAP_SYS_ADMIN               | ❌            |
| Prepare basic device nodes      | CAP_MKNOD or CAP_SYS_ADMIN  | ❌            |

(*): No capability is required as long as all of the following is respected:
your kernel is built with `CONFIG_USER_NS=y`
your Linux distribution does not add a distro-specific knob to restrict it (`sysctl kernel.unprivileged_userns_clone` on Arch Linux)
your uid mappings respect the restriction mentioned above
seccomp is not blocking the `unshare` system call (as it could be in some Docker profiles)

### Each Linux namespace is owned by a user namespace

Each Linux namespace instance, no matter what kind (mount, pid, etc.), has a user namespace owner. It is the user namespace where the process that created it sits. When several kinds of Linux namespaces are created in a single syscall, the newly created user namespace owns the other newly created namespaces.

```
clone(CLONE_NEWUSER | CLONE_NEWPID | CLONE_NEWNS);
```

<figure class="img-fluid w-75 mx-auto">
        <img src="/media/unprivileged-builds-userns4.svg" class="img-fluid">
</figure>

The ownership of those namespaces is important because for most operations, the kernel will check that when determining whether a process has the proper capability.

In the example below, a process attempts to perform a `pivot_root()` syscall. To succeed, it needs to have `CAP_SYS_ADMIN` in the user namespace that owns the mount namespace where the process is located. In other words, having `CAP_SYS_ADMIN` in a unprivileged user namespaces does not allow you to “escape” the container and get more privileges outside.

<figure class="img-fluid w-75 mx-auto">
        <img src="/media/unprivileged-builds-caps.svg" class="img-fluid">
</figure>

This is done in the [function may_mount()](https://github.com/torvalds/linux/blob/v4.15/fs/namespace.c#L1664):
```
ns_capable(current->nsproxy->mnt_ns->user_ns, CAP_SYS_ADMIN);
```
The function `ns_capable()` checks if the `current` process has the `CAP_SYS_ADMIN` capability within the user namespace that owns the mount namespace (`mnt_ns`) where the current process is located (`current->nsproxy`).

So by creating the new mount namespace inside the unprivileged user namespace we could do more. We can check our progress, what we achieved so far:

| Operation                       | Capability required         | Without root? |
|---------------------------------|-----------------------------|:-------------:|
| Mount a new overlayfs           | CAP_SYS_ADMIN               | ❌            |
| Create new user namespace       | No capability required (*)  | ✅            |
| Create new (non-user) namespace | CAP_SYS_ADMIN               | ✅            |
| Chroot or pivot_root            | CAP_CHROOT or CAP_SYS_ADMIN | ✅            |
| Mount a new procfs              | CAP_SYS_ADMIN               | ❌            |
| Prepare basic device nodes      | CAP_MKNOD or CAP_SYS_ADMIN  | ❌            |

## What about mounting the new overlayfs?
We’ve seen that `pivot_root()` can be done without privileges by creating a new mount namespace owned by a new unprivileged user namespace. Isn’t this the same for mounting the new overlayfs? Granted, the `mount()` syscall is guarded by exactly the same call to `ns_capable()` that we have seen above for `pivot_root()`. Unfortunately, that’s not enough.
### New mounts vs bind mounts
The mount system call can perform distinct actions:

* **New mounts:** this mounts a filesystem that was not mounted before. A block device might be provided if the filesystem type requires one (ext4, vfat). Some filesystems don’t need a block device (FUSE, NFS, sysfs). But in any case, the kernel maintains a `struct super_block` to keep track of options such as read-only.

* **Bind mounts:** a filesystem can be mounted on several mountpoints. A bind mount adds a new mountpoint from an existing mount. This will not create a new superblock but reuse it. The aforementioned “read-only” option can be set at the superblock level but also at the mountpoint level. In the example below, /mnt/data is bind-mounted on /mnt/foo so they share the same superblock. It can be achieved with:
```bash
mount /dev/sdc /mnt/data		# new mount
mount --bind /mnt/data /mnt/foo	# bind mount
```

* Change options on an existing mount. This can be superblock options, per-mountpoint options or propagation options (most useful when having several mount namespaces).

<figure class="img-fluid w-75 mx-auto">
        <img src="/media/unprivileged-builds-superblock.svg" class="img-fluid">
</figure>

Each superblock has a user namespace owner. Each mount has a mount namespace owner. To create a new bind mount, having `CAP_SYS_ADMIN` in the user namespace that owns the mount namespace where the process is located is normally enough (we’ll see some exceptions later). But creating a new mount in a non-initial user namespace is only allowed in some filesystem types. You can find the list in the Linux git repository with:

```bash
$ git grep -nw FS_USERNS_MOUNT
```

It is allowed in procfs, tmpfs, sysfs, cgroupfs and a few others. It is disallowed in ext4, NFS, FUSE, overlayfs and most of them actually.

<figure class="img-fluid w-75 mx-auto">
        <img src="/media/unprivileged-builds-superblock2.svg" class="img-fluid">
</figure>

So mounting a new overlayfs without privileges for container builds seems impossible. At least with upstream Linux kernels: Ubuntu kernels had for some time the ability to do new mounts of overlayfs and FUSE in an unprivileged user namespace by adding the flag `FS_USERNS_MOUNT` on those 2 filesystem types along with necessary fixes.

Kinvolk worked with a client to [contribute](https://lwn.net/Articles/742138/) to the upstreaming effort of the FUSE-part of patches. Once everything is upstream, we will be able to mount overlayfs.

The FUSE mount will be upstreamed first, before the overlayfs. At that point, overlayfs could theoretically be re-implemented in userspace with a FUSE driver.

| Operation                       | Capability required         | Without root? |
|---------------------------------|-----------------------------|:-------------:|
| Mount a new overlayfs           | CAP_SYS_ADMIN               | ✅ (soon)     |
| Create new user namespace       | No capability required (*)  | ✅            |
| Create new (non-user) namespace | CAP_SYS_ADMIN               | ✅            |
| Chroot or pivot_root            | CAP_CHROOT or CAP_SYS_ADMIN | ✅            |
| Mount a new procfs              | CAP_SYS_ADMIN               | ❌            |
| Prepare basic device nodes      | CAP_MKNOD or CAP_SYS_ADMIN  | ❌            |

## What about procfs?

As noted above, procfs has the `FS_USERNS_MOUNT` flag so it is possible to mount it in an unprivileged user namespace. Unfortunately, there are other restrictions which block us in practice in Docker or Kubernetes environments.

### What are locked mounts?

To explain locked mounts, we’ll first have a look at [systemd’s sandboxing features](https://www.freedesktop.org/software/systemd/man/systemd.exec.html#Sandboxing). It has a feature to run services in a different mount namespace so that specific files and directories are read-only (`ReadOnlyPaths=`) or inaccessible (`InaccessiblePaths=`). The read-only part is implemented by bind-mounting the file or directory over itself and changing the mountpoint option to read-only. The inaccessible part is done by bind-mounting an empty file or an empty directory on the mountpoint, hiding what was there before.

Using bind mounts as a security measure to make files read-only or inaccessible is not unique to systemd: container runtimes do the same. This is only secure as long as the application cannot umount that bind mount or move it away to see what was hidden under it. Both `umount` and moving a mount away (`MS_MOVE`) can be done with `CAP_SYS_ADMIN`, so systemd documentation suggests to not give that capability to a service if such sandboxing features were to be effective. Similarly, Docker and rkt don’t give `CAP_SYS_ADMIN` by default.

We can imagine another way to circumvent bind mounts to see what’s under the mountpoint: using unprivileged user namespaces. Applications don’t need privileges to create a new mount namespace inside a new unprivileged user namespace and then have `CAP_SYS_ADMIN` there. Once there, what’s preventing the application from removing the mountpoint with `CAP_SYS_ADMIN`? The answer is that the kernel detects such situations and marks mountpoints inside a mount namespace owned by an unprivileged user namespace as locked (flag `MNT_LOCK`) if they were created while cloning the mount namespace belonging to a more privileged user namespace. Those cannot be umounted or moved.

<figure class="img-fluid m-50 w-75 mx-auto">
        <img src="/media/unprivileged-builds-mntlock.svg" class="img-fluid">
</figure>

Let me describe what's in this diagram:

* On the left: the host mount namespace with a `/home` directory for Alice and Bob.

* In the middle: a mount namespace for a systemd service that was started with the option “ProtectHome=yes”. `/home` is masked by a mount, hiding the `alice` and `bob` subdirectories.

* On the right: a mount namespace created by the aforementioned systemd service, inside a unprivileged user namespace, attempting to umount /home in order to see what’s under it. But `/home` is a locked mount, so it cannot be unmounted there.

### The exception of procfs and sysfs

The explanation about locked mounts is valid for all filesystems, including procfs and sysfs but that's not the full story. Indeed, in the build container, we normally don’t do a bind mount of procfs but a new mount because we are inside a new pid namespace, so we want a new procfs that reflects that.

New mounts are normally independent from each other, so a masked path in a mount would not prevent another new mount: if /home is mounted from /dev/sdb and has masked paths, it should not influence /var/www mounted from /dev/sdc in any way.

But procfs and sysfs are different: some files there are singletons: for example, the file `/proc/kcore` refers to the same kernel object, even if it is accessed from different mounts. Docker masks the following files in /proc:

```
$ sudo docker run -ti --rm busybox mount | grep /proc/
proc on /proc/asound type proc (ro,nosuid,nodev,noexec,relatime)
proc on /proc/bus type proc (ro,nosuid,nodev,noexec,relatime)
proc on /proc/fs type proc (ro,nosuid,nodev,noexec,relatime)
proc on /proc/irq type proc (ro,nosuid,nodev,noexec,relatime)
proc on /proc/sys type proc (ro,nosuid,nodev,noexec,relatime)
proc on /proc/sysrq-trigger type proc (ro,nosuid,nodev,noexec,relatime)
tmpfs on /proc/kcore type tmpfs (rw,context="...",nosuid,mode=755)
tmpfs on /proc/latency_stats type tmpfs (rw,context="...",nosuid,mode=755)
tmpfs on /proc/timer_list type tmpfs (rw,context="...",nosuid,mode=755)
tmpfs on /proc/sched_debug type tmpfs (rw,context="...",nosuid,mode=755)
tmpfs on /proc/scsi type tmpfs (ro,seclabel,relatime)
```

The capability needed to circumvent the restriction on those files is normally `CAP_SYS_ADMIN` (for e.g. `umount`). To prevent a process without `CAP_SYS_ADMIN` from accessing those masked files by mounting a new procfs mount inside a new unprivileged user namespace and new mount namespace, the kernel uses the function `mount_too_revealing()` to check that procfs is already fully visible. If not, the new procfs mount is denied.

|             | Protected by              | Protection applies for filesystem types |
|-------------|---------------------------|-----------------------------------------|
| Bind mounts | Locked mounts (MNT_LOCK)  | all                                     |
| New mounts  | mount_too_revealing()     | procfs and sysfs                        |

This is blocking us from mounting procfs from within a Kubernetes pod.

<figure class="img-fluid w-75 mx-auto">
        <img src="/media/unprivileged-builds-kubernetes2.svg" class="img-fluid">
</figure>

Several workarounds are possible:

* Avoid mounting procfs in the build environment and update Dockerfiles that depend on it.
* Using a Kubernetes container with privileges, so that /proc in the Docker container is not covered. A “[rawproc](https://github.com/kubernetes/community/pull/1934)” option in Kubernetes is being discussed with the [underlying implementation in moby](https://github.com/moby/moby/issues/36597).
* Changing the kernel to allow a new procfs mount in an unprivileged user namespace, even when the parent proc mount is not fully visible, but with the same masks in the child proc mount. I started this discussion in a [RFC patch](https://lists.linuxfoundation.org/pipermail/containers/2018-April/038840.html) and there is an [alternative proposal by Djalal Harouni](https://lists.linuxfoundation.org/pipermail/containers/2018-April/038864.html) to fix procfs more generally.

## Conclusion

As you can see there are a lot of moving parts, as is the general case with Linux containers. But this is an area where development is quite active at the moment and hope for progress is greater than it has ever been. This blog post explored some aspects of the underlying mechanisms on Linux that are being worked on for unprivileged container builds: user namespaces, mounts, some filesystems. We hope to bring you updates about unprivileged container builds in the future and especially about our own involvement in these efforts.

## Kinvolk’s offerings

Kinvolk is an engineering team based in Berlin working on Linux, Containers and Kubernetes. We combine our expertise of low-level Linux details like capabilities, user namespaces and the details of FUSE with our expertise of Kubernetes to offer specialised services for your infrastructure that goes all the way down the stack. Contact us at <hello@kinvolk.io> to learn more about what Kinvolk does.
