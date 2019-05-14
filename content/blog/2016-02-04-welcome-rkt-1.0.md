+++
authors = ["Chris Kühl"]
date = "2016-02-04T19:04:00+01:00"
description = "Celebrating the release of rkt 1.0"
draft = false
tags = ["release", "rkt", "systemd"]
title = "Welcome rkt 1.0!"
topics = ["Announcement", "Containers", "rkt"]
postImage =  "article-hero.jpg"

+++

About 14 months ago, CoreOS [announced](https://coreos.com/blog/rocket/) their intention to build a new container runtime based on the [App Container Specification](https://github.com/appc/spec), introduced at the same time. Over these past 14 months, [the rkt team](https://github.com/coreos/rkt/graphs/contributors) has worked to make [rkt](https://github.com/coreos/rkt) viable for production use and get to a point where we could offer certain stability guarantees. With today’s release of [rkt 1.0](https://coreos.com/blog/rkt-hits-1.0.html), the rkt team believes we have reached that point.

We’d like to congratulate [CoreOS](https://coreos.com/) on making it to this milestone and look forward to seeing rkt mature. With rkt, CoreOS has provided the community with a container runtime with first-class integration on modern Linux systems and a security-first approach.

We’d especially like to thank CoreOS for giving us the chance to be involved with rkt. Over the past months we’ve had the pleasure to make substantial contributions to rkt. Now that the [1.0 release](https://github.com/coreos/rkt/releases/tag/v1.0.0) is out, we look forward to continuing that, with even greater input from and collaboration with the community.

At Kinvolk, we want to push Linux forward by contributing to projects that are at the core of modern Linux systems. We believe that rkt is one of these technologies. We are especially happy that we could work to make the integration with systemd as seamless as possible. There’s still work on this front to do but we’re happy with where we’ve gotten so far.

rkt is so important because it fills a hole that was left by other container runtimes. It lets the operating system do what it does best, manage processes. We believe whole-heartedly when [Lennart](http://0pointer.de/lennart/), creator and lead developer of the systemd project, states...

{{< quotation quote="I believe in the rkt model. Integrating container and service management, so that there's a 1:1 mapping between containers and host services is an excellent idea. Resource management, introspection, life-cycle management of containers and services -- all that tightly integrated with the OS, that's how a container manager should be designed." source="Lennart Poettering" >}}

Over the next few weeks, we’ll be posting a series of blog stories related to rkt. Follow [Kinvolk on twitter](https://twitter.com/kinvolkio) to get notified when they go live and follow the story.
