"""Apply only reviewed order-flow edits to the owner's current source, never stale root PHP."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


class NativeOrderFlowPatcher:
    """Stage bounded source replacements and public dependencies before changing any files."""

    def __init__(self, repository: Path) -> None:
        """Resolve the public patch package independently from the private source directory."""
        self.repository = repository
        self.operations: list[dict[str, str | int]] = []

    def replace(
        self, files: dict[str, str], name: str, old: str, new: str, count: int = 1
    ) -> None:
        """Require the exact source anchor count before applying an operation in memory."""
        if files[name].count(old) != count:
            raise ValueError(f"Anchor mismatch: {name}")
        files[name] = files[name].replace(old, new)
        self.operations.append({"file": name, "old": old, "new": new, "count": count})

    def apply(self, source: Path, output: Path) -> dict[str, object]:
        """Validate all anchors, then write a separate staged package and a source hash manifest."""
        names = ["index.php", "partners/index.php"]
        files = {name: (source / name).read_text() for name in names}
        before = {
            name: hashlib.sha256((source / name).read_bytes()).hexdigest()
            for name in names
        }
        for name in names:
            # Routes are initialized immediately before an existing authenticated API route.
            anchor = "if($p==='/api/orders'&&$m==='GET')"
            prefix = "dirname(__DIR__)" if name.startswith("partners/") else "__DIR__"
            self.replace(
                files,
                name,
                anchor,
                f"require_once {prefix}.'/lib/native-order-flow-routes.php';\n"
                + anchor,
            )
        name = "partners/index.php"
        self.replace(
            files,
            name,
            "$paymentLabels=['cash'=>'نقد','check'=>'اعتباری با چک','online'=>'آنلاین'];",
            "$paymentLabels=['cash'=>'نقد','check'=>'چک','credit'=>'اعتباری','online'=>'آنلاین'];",
        )
        anchor = (
            "    $requestedPayment=trim((string)($x['requested_payment_method']??''));"
        )
        self.replace(
            files,
            name,
            anchor,
            "    if($isCustomer){try{$gpCustomerOrderFlow->validateRequest($x);}catch(InvalidArgumentException $error){fail($error->getMessage(),422);}}\n"
            + anchor,
        )
        self.replace(
            files,
            name,
            "$paymentLabels,$promoInput){",
            "$paymentLabels,$promoInput,$gpCustomerOrderFlow){",
        )
        old = "if(isset($seenItems[$name]))fail('هر مدل را فقط یک‌بار در سفارش ثبت کنید');$seenItems[$name]=true;"
        new = "$purchaseIdentity=$isCustomer?$name.\"\\0\".trim((string)($it['price_key']??'')):$name;if(isset($seenItems[$purchaseIdentity]))fail('این مدل با همین نوع خرید قبلاً ثبت شده است');$seenItems[$purchaseIdentity]=true;"
        self.replace(files, name, old, new)
        self.replace(
            files,
            name,
            "        $discount=0;$offer=null;",
            "        $purchaseItems=$items;if($isCustomer)$items=$gpCustomerOrderFlow->fulfillmentItems($purchaseItems);\n        $discount=0;$offer=null;",
        )
        anchor = "        $o['payment_method']='';$o['payment_method_label']='';$o['payment_details']=[];$o['check_status']='';$o['credit_status']='';$o['installment_status']='';"
        new = (
            anchor
            + "\n        if($isCustomer){$o['purchase_items']=$purchaseItems;$o['native_settlement']=array_merge(gp_r54_settlement($x,$u,$o),$gpCustomerOrderFlow->creditCommitment($x));unset($o['settlement_details']);}"
        )
        self.replace(files, name, anchor, new)
        # Activate only the existing credit read route, leaving login/OTP routing untouched.
        anchor = "require_once dirname(__DIR__).'/lib/native-order-flow-routes.php';"
        self.replace(
            files,
            name,
            anchor,
            "if(in_array($p,['/api/native/credit','/api/native/proof','/api/orders/add'],true))require_once __DIR__.'/native-r54.php';\n"
            + anchor,
        )
        for name in names:
            anchor = "if(($o['approval_status']??'')==='تأیید شده')fail('سفارش قبلاً تأیید شده است');"
            new = (
                anchor
                + "try{$GLOBALS['gpCustomerOrderFlow']->assertPending($o);}catch(InvalidArgumentException $error){fail($error->getMessage(),422);}"
            )
            self.replace(files, name, anchor, new)
            anchor = "if(array_key_exists('items',$x)){"
            # This anchor occurs once inside the actual order-edit route in the owner source.
            new = (
                anchor
                + "try{$GLOBALS['gpCustomerOrderFlow']->assertEditable($o);}catch(InvalidArgumentException $error){fail($error->getMessage(),422);}"
            )
            self.replace(files, name, anchor, new)
            self.replace(
                files,
                name,
                "$o['items']=$newItems;",
                "$o['items']=$newItems;if(isset($o['purchase_items']))$o['purchase_items']=$newItems;",
            )
        for name in [
            "lib/native-order-flow.php",
            "lib/native-order-flow-routes.php",
            "config/native-order-flow.yaml",
        ]:
            files[name] = (self.repository / name).read_text()
        expected = {
            name: hashlib.sha256(text.encode()).hexdigest()
            for name, text in files.items()
        }
        manifest: dict[str, object] = {
            "before_files": before,
            "operations": self.operations,
            "expected_files": expected,
        }
        for name, text in files.items():
            target = output / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(text)
        return manifest


def main() -> None:
    """Stage the supplied owner source and print only public hash/patch metadata."""
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--manifest", type=Path, required=True)
    args = parser.parse_args()
    manifest = NativeOrderFlowPatcher(Path(__file__).resolve().parents[1]).apply(
        args.source, args.output
    )
    args.manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
