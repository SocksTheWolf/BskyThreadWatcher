# BskyThreadWatcher

A microservice/runner that scrapes all the replies to a given post.

Throw this onto Cloudflare workers and call it a day. You'll have every post ever made to the thread.

## What

Given a post thread, the following will occur:

* Thread will periodically be scanned for new posts added to it
* The first record will be checked to make sure we have changes
* Each record we do not have will be subject to be scraped, all content will be pulled and pushed to R2 and relayed to a Discord webhook

Completely bypasses the 100 post unstable appview, guaranteeing that you get EVERY response, even if someone deletes it later.

Also keeps things nice and organized. Very handy.

To use, check out all the comments and config in `wrangler.toml`. Change to your preferences/needs.

## Post Types Supported

* Images
* Galleries
* Weblinks
* Records (will traverse until media is found)
* Records With Media (will take the first media found)

### Limitations

No videos and no support for quote replies. While QRTs could be handy, anyone who's doing that to enter is getting thrown into the ground.

## Runtime

Because firehose is overkill, this instead listens to a filtered system called "constellation" [provided by Microcosm](https://constellation.microcosm.blue).

While this does mean that the system is basically a glorified polling feature, it does allow for more portability and less compute cost.


---
Used for [OnlyUppies 4](https://onlyuppies.com)