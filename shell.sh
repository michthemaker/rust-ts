
git add .
git commit -m "[feat] shell.sh now removed from .gitignore "
git push origin feat/traits


# drop traits for everyone and check it in move
# go to mpmc and mpsc and do impl(Trait, ChannelHandle)<T>
# and remove implements disposable from all places
# send traits for multi threading, check it in drop and move
# type the vec usize and all
#
# edge case fixed array of or normal type not implementing debug  undefined fails println and objects that don't implement println
# understand why we use blocking_send|recv
# threading thread names
# Given your “Rust-like DX first” goal, I’d lean toward option 2 and make it throw a clear error if called on the main thread.

# Missing pieces I noticed while reading: try_recv, recv_timeout, and a blocking iter(). Yours is an async generator, so it needs for await, whereas Rust’s is a plain for loop.
