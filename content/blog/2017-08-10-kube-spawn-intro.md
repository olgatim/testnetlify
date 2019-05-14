+++
authors = ["Chris Kühl"]
date = "2017-08-10T12:04:00+01:00"
title = 'Introducing kube-spawn: a tool to create local, multi-node Kubernetes clusters'
description = ""
draft = false
tags = ["kube-spawn", "kubernetes", "systemd", "nspawn", "containers", "machinectl", "kubeadm"]
topics = ["Containers", "Kubernetes", "Tools", "Project"]
postImage =  "article-hero.jpg"
+++

___[kube-spawn](https://github.com/kinvolk/kube-spawn/)___ is a tool to easily start a local, multi-node [Kubernetes](https://kubernetes.io) cluster on a Linux machine. While its original audience was mainly developers of Kubernetes, it's turned into a tool that is great for just trying Kubernetes out and exploring. This article will give a general introduction to _kube-spawn_ and show how to use it.

## Overview

_kube-spawn_ aims to become the easiest means of testing and fiddling with Kubernetes on Linux. We started the project because it is still rather painful to start a multi-node Kubernetes cluster on our development machines. And the tools that do provide this functionality generally do not reflect the environments that Kubernetes will eventually be running on, a full Linux OS.

## Running a Kubernetes cluster with kube-spawn

So, without further ado, let's start our cluster. With one command _kube-spawn_ fetches the [Container Linux](https://coreos.com/os/docs/latest) image, prepares the nodes, and deploys the cluster. Note that you can also do these steps individually with `machinectl pull-raw`, and the __kube-spawn__ `setup` and `init` subcommands. But the `up` subcommand does this all for us.

```bash
$ sudo GOPATH=$GOPATH CNI_PATH=$GOPATH/bin ./kube-spawn up --nodes=3
```

When that command completes, you'll have a 3-node Kubernetes cluster. You'll need to wait for the nodes to be ready before its useful.

```bash
$ export KUBECONFIG=$GOPATH/src/github.com/kinvolk/kube-spawn/.kube-spawn/default/kubeconfig
$ kubectl get nodes
NAME           STATUS    AGE       VERSION
kube-spawn-0   Ready     1m        v1.7.0
kube-spawn-1   Ready     1m        v1.7.0
kube-spawn-2   Ready     1m        v1.7.0
```

Looks like all the nodes are ready. Let's move on.

## The demo app

In order to test that our cluster is working we're going to deploy the [microservices demo, Sock Shop](https://github.com/microservices-demo/microservices-demo), from our friends at [Weaveworks](https://www.weave.works/). The Sock Shop is a complex microservices app that uses many components commonly found in real-world deployments. So it's good to test that everything is working and gives us something more substantial to explore than a hello world app.

### Cloning the demo app

To proceed, you'll need to clone the `microservices-demo` repo and navigate to the `deploy/kubernetes` folder.

```bash
$ cd ~/repos
$ git clone https://github.com/microservices-demo/microservices-demo.git sock-shop
$ cd sock-shop/deploy/kubernetes/
```

### Deploying the demo app

Now that we have things in place, let's deploy. We first need to create the sock-shop namespace that the deployment expects.

```bash
$ kubectl create namespace sock-shop
namespace "sock-shop" created
```

With that, we've got all we need to deploy the app

```bash
$ kubectl create -f complete-demo.yaml
deployment "carts-db" created
service "carts-db" created
deployment "carts" created
service "carts" created
deployment "catalogue-db" created
service "catalogue-db" created
deployment "catalogue" created
service "catalogue" created
deployment "front-end" created
service "front-end" created
deployment "orders-db" created
service "orders-db" created
deployment "orders" created
service "orders" created
deployment "payment" created
service "payment" created
deployment "queue-master" created
service "queue-master" created
deployment "rabbitmq" created
service "rabbitmq" created
deployment "shipping" created
service "shipping" created
deployment "user-db" created
service "user-db" created
deployment "user" created
service "user" created
```

Once that completes, we still need to wait for all the pods to come up.

```bash
$ watch kubectl -n sock-shop get pods
NAME                            READY     STATUS    RESTARTS   AGE
carts-2469883122-nd0g1          1/1       Running   0          1m
carts-db-1721187500-392vt       1/1       Running   0          1m
catalogue-4293036822-d79cm      1/1       Running   0          1m
catalogue-db-1846494424-njq7h   1/1       Running   0          1m
front-end-2337481689-v8m2h      1/1       Running   0          1m
orders-733484335-mg0lh          1/1       Running   0          1m
orders-db-3728196820-9v07l      1/1       Running   0          1m
payment-3050936124-rgvjj        1/1       Running   0          1m
queue-master-2067646375-7xx9x   1/1       Running   0          1m
rabbitmq-241640118-8htht        1/1       Running   0          1m
shipping-2463450563-n47k7       1/1       Running   0          1m
user-1574605338-p1djk           1/1       Running   0          1m
user-db-3152184577-c8r1f        1/1       Running   0          1m
```

### Accessing the sock shop

When they're all ready, we have to find out which port and IP address we use to access the shop. For the port, let's see which port the front-end services is using.

```bash
$ kubectl -n sock-shop get svc
NAME           CLUSTER-IP       EXTERNAL-IP   PORT(S)        AGE
carts          10.110.14.144    <none>        80/TCP         3m
carts-db       10.104.115.89    <none>        27017/TCP      3m
catalogue      10.110.157.8     <none>        80/TCP         3m
catalogue-db   10.99.103.79     <none>        3306/TCP       3m
front-end      10.105.224.192   <nodes>       80:30001/TCP   3m
orders         10.101.177.247   <none>        80/TCP         3m
orders-db      10.109.209.178   <none>        27017/TCP      3m
payment        10.107.53.203    <none>        80/TCP         3m
queue-master   10.111.63.76     <none>        80/TCP         3m
rabbitmq       10.110.136.97    <none>        5672/TCP       3m
shipping       10.96.117.56     <none>        80/TCP         3m
user           10.101.85.39     <none>        80/TCP         3m
user-db        10.107.82.6      <none>        27017/TCP      3m
```

Here we see that the front-end is exposed on port 30001 and it uses the <nodes> external IP. This means that we can access the front-end services using any worker node IP address on port 30001. `machinectl` gives us each node's IP address.

```bash
$ machinectl
MACHINE      CLASS     SERVICE        OS     VERSION  ADDRESSES
kube-spawn-0 container systemd-nspawn coreos 1492.1.0 10.22.0.137...
kube-spawn-1 container systemd-nspawn coreos 1492.1.0 10.22.0.138...
kube-spawn-2 container systemd-nspawn coreos 1492.1.0 10.22.0.139...
```

Remember, the first node is the master node and all the others are worker nodes. So in our case, we can open our browser to `10.22.0.138:30001` or `10.22.0.139:30001` and should be greeted by a shop selling socks.

## Stopping the cluster

Once you're done with your sock purchases, you can stop the cluster.

```bash
$ sudo ./kube-spawn stop
2017/08/10 01:58:00 turning off machines [kube-spawn-0 kube-spawn-1 kube-spawn-2]...
2017/08/10 01:58:00 All nodes are stopped.
```

## A guided demo

If you'd like a more guided tour, you'll find it here.

{{< youtube Zp3AtfibXdM>}}

As mentioned in the video, __kube-spawn__ creates a `.kube-spawn` directory in the current directory where you'll find several files and directories under the `default` directory. In order to not be constrained by the size of each OS Container, we mount each node's `/var/lib/docker` directory here. In this way, we can make use of the host's disk space. Also, we don't currently have a `clean` command. So you can run `rm -rf .kube-spawn/` if you want to completely clean up things.

## Conclusion
We hope you find _kube-spawn_ as useful as we do. For us, it's the easiest way to test changes to Kubernetes or spin up a cluster to explore Kubernetes.

There are still lots of improvements (some very obvious) that can be made. PRs are very much welcome!

