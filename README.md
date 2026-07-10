# recorder

Record a Concept2 PM5 ergometer session and export it as a CSV playable back in
[pm5-base](https://github.com/ergarcade/pm5-base)'s example app.

## Getting the code

This repo pulls in `pm5-base` as a git submodule, so clone with:

```
git clone --recurse-submodules https://github.com/ergarcade/recorder.git
```

If you already cloned without that flag:

```
git submodule update --init
```

## Updating the pm5-base submodule

```
git submodule update --remote pm5-base
git add pm5-base
git commit -m "Update pm5-base submodule"
```
