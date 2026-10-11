# Security Policy

## Maintainer and security contact

Tim Daubenschütz ([@TimDaub](https://github.com/TimDaub)) created kiwistand and maintains it. He is also its security contact and handles every vulnerability report.

## Reporting a vulnerability

Please report vulnerabilities privately, not in public issues, pull requests or the Telegram chats.

- Preferred: open a private report through GitHub at https://github.com/attestate/kiwistand/security/advisories/new
- Email: tim@daubenschuetz.de

Please include the affected component, the steps to reproduce, and what an attacker could do with it.

You can expect a reply within 7 days. Once a fix is ready, we deploy it to news.kiwistand.com and publish an advisory that credits you, unless you prefer to stay anonymous.

## Scope

In scope:

- The code in this repository: the node, the HTTP and API servers, the web frontend, and the peer-to-peer protocol
- The node behind news.kiwistand.com that we operate

Out of scope:

- Nodes run by other operators
- Third-party services that Kiwi News uses
- Denial of service through traffic volume
- Social engineering

## Supported versions

Only the latest commit on `main` is supported. That is the code running on news.kiwistand.com.
