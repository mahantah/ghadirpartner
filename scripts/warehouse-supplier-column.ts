interface SupplierCarton {
  id?: number | string;
  code?: string;
  supplier?: string;
}

interface SupplierState {
  cartons: SupplierCarton[];
}

/** Render purchase suppliers using carton identity and the current table header. */
class WarehouseSupplierColumn {
  constructor(
    private readonly dom: Document,
    private readonly supplier: (carton: SupplierCarton) => string,
  ) {}

  /** Refresh existing cells without changing selection, actions, or stock state. */
  render(state: SupplierState): void {
    const body = this.dom.getElementById("warehouseBody");
    const header = body?.closest("table")?.querySelector("thead tr");
    if (!body || !header) return;
    const headers = Array.from(header.children);
    const modelIndex = headers.findIndex((cell) =>
      /مدل/.test(cell.textContent ?? ""),
    );
    if (modelIndex < 0) return;
    let supplierIndex = headers.findIndex((cell) =>
      /ت[اأ]مین[\s‌-]*کننده/.test(cell.textContent ?? ""),
    );
    if (supplierIndex < 0) {
      const cell = this.dom.createElement("th");
      cell.textContent = "تامین‌کننده";
      headers[modelIndex]?.after(cell);
      supplierIndex = modelIndex + 1;
    }
    const columnCount = header.children.length;
    const codeIndex = Array.from(header.children).findIndex((cell) =>
      /شماره باکس|کد باکس|شماره کارتن|کد کارتن/.test(cell.textContent ?? ""),
    );
    for (const row of body.querySelectorAll("tr")) {
      if (row.querySelector("td[colspan]")) continue;
      const selectedId = row
        .querySelector(".gp-wh-carton-label-check")
        ?.getAttribute("data-carton-id");
      const code = (
        row.querySelector("b.code")?.textContent ??
        row.children[codeIndex]?.textContent ??
        ""
      )
        .trim()
        .toUpperCase();
      const carton = state.cartons.find((item) =>
        selectedId
          ? Number(item.id) === Number(selectedId)
          : String(item.code ?? "")
              .trim()
              .toUpperCase() === code && code !== "",
      );
      if (!carton) continue;
      let cell = row.querySelector<HTMLTableCellElement>(
        ".gp-supplier-v5-cell, .gp-supplier-cell",
      );
      // A native supplier column already has a cell; reuse it after every render.
      if (!cell && row.children.length === columnCount) {
        cell = row.children.item(supplierIndex) as HTMLTableCellElement | null;
      }
      if (!cell) cell = this.dom.createElement("td");
      cell.classList.add("gp-supplier-v5-cell", "gp-supplier-cell");
      if (row.children.item(supplierIndex) !== cell) {
        cell.remove();
        row.insertBefore(cell, row.children.item(supplierIndex));
      }
      const value = this.supplier(carton).trim() || "-";
      // The legacy observer watches DOM changes; avoid triggering it indefinitely.
      if (
        cell.textContent !== value ||
        cell.firstElementChild?.tagName !== "B"
      ) {
        const label = this.dom.createElement("b");
        label.textContent = value;
        cell.replaceChildren(label);
      }
    }
  }
}
