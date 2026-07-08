# LazyHTML

A dependency-free JavaScript runtime, by **[`RoomOff`](https://roomoff.com/lazyhtml/)** (Jade Hamel), that turns HTML
attributes directly into CSS. Instead of writing a stylesheet and a class
name, you write the style vocabulary straight onto the tag:

```html
<button
  bg="#34d399" color="#04150e"
  pad-x="20" pad-y="10" radius="999" bold="true"
  hover:scale="1.03" transition="all .15s ease">
  Ship it
</button>
```

LazyHTML resolves each element's attributes into a single, deduplicated
CSS class, injected once into a runtime stylesheet — lazily, either the
first time that exact combination is seen, or (with `lazy="true"`) only
once the element nears the viewport.

## Install

No build step required. Just include the bundle:

```html
<script src="dist/lazy-html.js"></script>
```

## Docs & demo

- [`docs/index.html`](docs/index.html) — full documentation
- [`demo/index.html`](demo/index.html) — a live "super demo" exercising the whole vocabulary

## Source layout

See `docs/index.html#file-structure` for the annotated breakdown of `src/`.

## License

MIT — see `LICENSE`.
