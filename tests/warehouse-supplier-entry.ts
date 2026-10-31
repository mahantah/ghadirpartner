import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

interface EntryField {
  value: string;
  checked: boolean;
  files: string[];
}
interface ImportRequest {
  url: string;
  body: Record<string, unknown>;
}
interface EntryWindow {
  saveWarehouseCarton?: () => Promise<void>;
  saveWarehouseFile?: () => Promise<void>;
}

/** Exercise the reviewed private handlers without touching a server or real data. */
class SupplierEntryRegression {
  private readonly handlers: [keyof EntryWindow, string][];

  /** Load only the two active entry handlers from the supplied staged asset. */
  constructor(source: string) {
    this.handlers = (["saveWarehouseCarton", "saveWarehouseFile"] as const).map(
      (name) => {
        const start = source.indexOf(`window.${name}=`);
        assert.ok(start >= 0, "missing active handler");
        return [name, source.slice(start, source.indexOf("\n", start))];
      },
    );
  }

  /** Verify both transport formats, success cleanup, failure retention and stock fields. */
  async run(): Promise<void> {
    for (const [name, handler] of this.handlers) {
      for (const fail of [false, true]) {
        const fields = new Map<string, EntryField>();
        const field = (id: string): EntryField => {
          const result = fields.get(id);
          assert.ok(result, "unknown field");
          return result;
        };
        for (const key of [
          "whProduct",
          "whColor",
          "whSupplier",
          "whCapacity",
          "whIncomplete",
          "whShelf",
          "whReason",
          "whWarehouse",
          "whFile",
          "whSerials",
          "whScan",
        ])
          fields.set(key, { value: "", checked: false, files: [] });
        field("whProduct").value = "fixture-model";
        field("whColor").value = " blue ";
        field("whSupplier").value = "  fixture-supplier  ";
        field("whCapacity").value = "20";
        field("whWarehouse").value = "2";
        field("whFile").files = ["fixture.csv"];
        field("whIncomplete").checked = true;
        field("whShelf").value = "3";
        field("whReason").value = " fixture-reason ";
        const requests: ImportRequest[] = [];
        const alerts: string[] = [];
        const loads: string[] = [];
        const entryWindow: EntryWindow = {};
        const context = vm.createContext({
          window: entryWindow,
          $: (id: string) => {
            assert.ok(fields.has(id));
            return field(id);
          },
          warehouseSerialList: () => ["FIXTURE-SN"],
          FormData: class {
            values: Record<string, unknown> = {};
            append(key: string, value: unknown) {
              this.values[key] = value;
            }
          },
          req: async (
            url: string,
            options: { body: string | { values: Record<string, unknown> } },
          ) => {
            requests.push({
              url,
              body:
                typeof options.body === "string"
                  ? (JSON.parse(options.body) as Record<string, unknown>)
                  : options.body.values,
            });
            if (fail) throw new Error("fixture-request-failed");
            return { code: "FIXTURE-BOX", serials: ["FIXTURE-SN"] };
          },
          alert: (message: string) => alerts.push(message),
          toast: () => {},
          warehouseCount: () => {},
          whName: () => "fixture-warehouse",
          loadWarehouse: async () => loads.push("warehouse"),
          loadWarehouseLedger: async () => loads.push("ledger"),
        });
        vm.runInContext(handler, context);
        const save = entryWindow[name];
        assert.ok(save);
        await save();
        assert.equal(requests.length, 1);
        const request = requests[0];
        assert.ok(request);
        assert.equal(
          request.url,
          name === "saveWarehouseCarton"
            ? "/api/warehouse/import"
            : "/api/warehouse/import-file",
        );
        assert.equal(
          request.body.supplier,
          "fixture-supplier",
          "supplier omitted",
        );
        assert.equal(
          String(request.body.warehouse_id),
          "2",
          "warehouse changed",
        );
        assert.equal(request.body.product, "fixture-model");
        assert.equal(request.body.color, "blue");
        assert.equal(String(request.body.capacity), "20");
        assert.equal(String(request.body.shelf_level), "3");
        assert.equal(request.body.incomplete_reason, "fixture-reason");
        assert.equal(String(request.body.allow_incomplete), "true");
        if (name === "saveWarehouseCarton") {
          assert.ok(Array.isArray(request.body.serials));
          assert.equal(request.body.serials.join(","), "FIXTURE-SN");
        } else assert.equal(request.body.file, "fixture.csv");
        assert.equal(
          field("whSupplier").value,
          fail ? "  fixture-supplier  " : "",
        );
        assert.equal(alerts.length, fail ? 1 : 0);
        assert.equal(loads.length, fail ? 0 : 2);
      }
    }
    console.log(
      "SUPPLIER_ENTRY_PASS: manual/file requests and failure retention",
    );
  }
}

new SupplierEntryRegression(fs.readFileSync(process.argv[2] ?? "", "utf8"))
  .run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
