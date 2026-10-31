# Warehouse purchase supplier column

The legacy V5 supplier decorator reads the carton code from `cells[0]` and
inserts its supplier cell after `children[1]`. The label-selection feature adds
a leading checkbox, so these positions refer to different columns. The V4
decorator can also insert a second supplier column before V5 runs.

`WarehouseSupplierColumn` matches the selected carton ID (or its exact code)
and locates columns from the current header. It reuses native supplier cells,
preserves print buttons and checkbox nodes, and writes supplier names as text.
It retains the existing V5 supplier resolver, including inventory fallback.

The offline patch validates the exact reviewed legacy renderer hash and skips
the redundant V4 warehouse decorator only when V5 is present. It stages a new
file and refuses to overwrite either the source or an existing output:

```sh
python3 scripts/patch-warehouse-supplier-column.py /private/app.html /private/app-staged.html
```

This patch changes only supplier-column rendering. It does not repair missing
supplier values in storage or modify warehouse, carton, serial, or order data.
Private production source is not included in this repository. Validation against
the current owner HTML and the existing protected-carton release checks remains
required before an owner-approved deployment. The separate release workflow runs
only by manual dispatch or a change to its exact release sentinel on main.
It stages against current owner HTML, checkpoints the original HTML privately,
and uses the existing server-side protected-carton guard before and after the
atomic replacement. Failed readback or health checks restore the checkpoint.

## Active import handlers omit the supplier

The separate active `assets/warehouse-v53438.js` overrides both entry handlers
after the inline HTML loads. Its manual JSON payload and file FormData omit
`supplier`, although the inline handlers include it. The previous column fix
therefore cannot display a name that was never submitted.

`scripts/patch-warehouse-supplier-entry.py` stages a bounded correction against
the reviewed private asset. It includes the trimmed supplier in both requests
and clears the input only after a successful response. Warehouse selection,
serials, capacity, partial-carton reason, shelf and refresh behavior are retained.
Configuration validates each complete handler hash; unexpected source or partial
installations fail closed. Existing output files cannot be overwritten.

The entry CI downloads only the public JavaScript asset into a private temporary
directory, reproduces the missing supplier with synthetic input, then executes
both staged handlers. It also checks request failures retain the supplier and
rejects unreviewed source changes. Private application code and real inventory
data are never committed or logged. This patch is prepared for review and has
not been deployed; existing missing names require a separately approved,
explicit carton correction through the application's supplier route.

Validation: project `npm run check`, strict TypeScript, ESLint with zero warnings,
Prettier, Ruff, strict mypy, bounded patch regression and browser fixtures for
checkbox/no-checkbox layouts, native/missing supplier columns, repeated renders,
updated names, safe text, empty states and preservation of selection/actions.
