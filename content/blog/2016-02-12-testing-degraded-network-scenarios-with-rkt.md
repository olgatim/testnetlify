+++
authors = ["Alban Crequy"]
date = "2016-02-12T10:31:00+01:00"
description = ""
draft = false
tags = ["rkt", "networking", "linux", "testing", "traffic control"]
title = "Testing Degraded Network Scenarios with rkt"
topics = ["Testing", "Containers", "Networking"]
postImage =  "article-hero.jpg"

+++

# The current state of testing

Testing applications is important. Some even go as far as saying, “If it isn’t tested, it doesn’t work”. While that may have both a degree of truth and untruth to it, the rise of continuous integration (CI) and automated testing have shown that the software industry is taking testing seriously.

However, there is at least one area of testing that is difficult to automate and, thus, hasn’t been adequately incorporated into testing scenarios: poor network connectivity.

The typical testing process has the developer as the first line of defence. Developers usually work within reliable networking conditions. The developers then submit their code to a CI system which also runs tests under good networking conditions. Once the CI system goes green, internal testing is usually done; ship it!

Nowhere in this process were scenarios tested where your application experiences degraded network conditions. If your internal tests don’t cover these scenarios then it’s your users who’ll be doing the testing. This is far from an ideal situation and goes against the “test early test often” mantra of CI; a bug will cost you more the later it’s caught.

### Three examples

To make this more concrete, let’s look at a few examples where users might notice issues that you, or your testing infrastructure, may not:

- **A web shop** you click on “buy”, it redirects to a new page but freezes because of a connection issue. The user does not get feedback whether the javascript code will try again automatically; the user does not know whether she should refresh. That’s a bug. Once fixed, how do you test it? You need to break the connection just before the test script clicks on the “buy” link.
- **A video stream server** The [Real-Time Protocol (RTP)](https://en.wikipedia.org/wiki/Real-time_Transport_Protocol) uses UDP packets. If some packets drop or arrive too late, it’s not a big deal; the video player will display a degraded video because of the missing packets but the stream will otherwise play just fine. Or, will it? So how can the developers of a video stream server test a scenario where 3% of packets are dropped or delayed?
- Applications like **[etcd](https://github.com/coreos/etcd) or [zookeeper](https://zookeeper.apache.org/)** implement [a consensus protocol](https://raft.github.io/). They should be designed to handle a node disconnecting from the network and network splits. See  [the approach CoreOS takes](https://coreos.com/blog/new-functional-testing-in-etcd.html) for an example.

It doesn’t take much imagination to come up with more, but these should be enough to make the point.

# Where Linux can help

What functionality does the Linux kernel provide to enable us to test these scenarios?

Linux provides a means to shape both the egress traffic (emitted by a network interface) and to some extend the ingress traffic (received by a network interface). This is done by way of qdiscs, short for queuing disciplines. In essence, a qdisc is a packet scheduler. Using different qdiscs we can change the way packets are scheduled. qdiscs can have associated classes and filters. These all combine to let us delay, drop, or rate-limit packets, among a host of other things. A complete description is out of the scope of this blog post.

{{< figure src="/media/host-networking-qdisc.svg" >}}

For our purposes, we’ll just look at one qdisc called “[netem](http://man7.org/linux/man-pages/man8/tc-netem.8.html)”, short for network emulation. This will allow us to tweak the packet scheduling characteristics we want.

### What about containers?

Up to this point we haven’t even mentioned containers. That’s because the story is the same with regards to traffic control whether we’re talking about bare-metal servers, VMs or containers. Containers reside in their own network namespace, providing the container with a completely isolated network. Thus, the traffic between containers, or between a container and the host, can all be shaped in the same way.

# Testing the idea

As a demonstration I’ve created a simple demo that starts an RTP server in a container using [rkt](https://github.com/coreos/rkt). In order to easily tweak network parameters, I’ve hacked up a GUI written in Gtk/Javascript. And finally, to see the results we just need to point a video player to our RTP server.

We’ll step through the demo below. But if you want to play along at home, you can find the code in the [kinvolk/demo repo](https://github.com/kinvolk/demo/tree/master/traffic-control-rkt) on [Github](https://github.com/kinvolk/)

### Running the demo

First, I start the video streaming server in a rkt pod. The server streams the [Elephant Dreams movie](https://orange.blender.org/) to a media player via the RTP/RTSP protocol. [RTSP](https://en.wikipedia.org/wiki/Real_Time_Streaming_Protocol) uses a TCP connection to send commands to the server. Examples of commands are choosing the file to play or seeking to a point in the middle of the stream. RTP it what actually sends the video via UDP packets.

{{< figure src="/media/container-host-networking-qdisc.svg" >}}

Second, we start the GUI to dynamically change some parameters of the network emulator. What this does is connect to the rkt network namespace and change the egress qdisc using Linux’s tc command.

Now we can adjust the values as we like. For example, when I add 5% packet loss, the quality is degraded but not interrupted. When I remove the packet loss, the video becomes clear again. When I add 10s latency in the network, the video freezes. Play the video to see this in action.

{{< youtube BU2n3E5SeN4>}}

What this shows us is that traffic control can be used effectively with containers to test applications - in this case a media server.

# Next steps

The drawback to this approach is that it’s still manual. For automated testing we don’t want a GUI. Rather, we need a means of scripting various scenarios.

In rkt we use [CNI](https://github.com/appc/cni) network plugins to configure the network. Interestingly, several plugins can be used together to defines several network interfaces. What I’d like to see is a plugin added that allows one to configure traffic control in the network namespace of the container.

In order to integrate this into testing frameworks, the traffic control parameters should be dynamically adjustable, allowing for the scriptability mentioned above.

# Stay tuned…

In a coming blog post, we’ll show that this is not only interesting when using rkt as an isolated component. It’s more interesting when tested in a container orchestration system like [Kubernetes](http://kubernetes.io/).

Follow [Kinvolk on twitter](https://twitter.com/kinvolkio) to get notified when new blog posts go live.
