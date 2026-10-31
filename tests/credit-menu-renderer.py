"""Exercise the actual customer menu renderer with synthetic identities in Chrome."""

import shutil
import subprocess
import tempfile
from pathlib import Path


class CreditMenuRendererCheck:
    """Load the existing renderer rather than duplicating its menu implementation."""

    def run(self) -> None:
        """Check visibility, permissions, duplicates and the selected customer callback."""
        root = Path(__file__).resolve().parents[1]
        source = (root / "assets/kartabl-sync-v1.js").read_text()
        renderer = (
            "function customerActionIcon"
            + source.split("function customerActionIcon", 1)[1].split(
                "function wrapMenu", 1
            )[0]
        )
        html = (
            """<!doctype html><html><body><output id="result">PENDING</output><script>
let allowed=true,opened=0;const PRICE_TITLE='تنظیمات مشاهده قیمت‌ها';
function has(){return allowed}function customerById(id){return {id}}function isActive(){return true}
function closeCustomerMenus(){}window.gpCustomerCredit={open(id){opened=id}};
"""
            + renderer
            + """
try{
 for(const permitted of [true,false]){
  allowed=permitted;document.querySelector('.customer-menu')?.remove();
  let menu=document.createElement('div');menu.className='order-menu customer-menu open';menu.style.cssText='position:fixed;top:95vh';document.body.append(menu);
  fillOpsMenu(42);fillOpsMenu(42);if([...menu.querySelectorAll('button')].some(b=>b.querySelectorAll('svg').length!==1))throw Error('missing or duplicate icon');let button=menu.querySelector('[data-gp-credit-action]');
  if(menu.getBoundingClientRect().bottom>innerHeight-7)throw Error('menu outside viewport');if(!!button!==permitted||menu.querySelectorAll('[data-gp-credit-action]').length>1)throw Error('visibility');
  if(button){button.click();if(opened!==42)throw Error('wrong customer')}
  if(!menu.textContent.includes('ویرایش مشخصات')||!menu.textContent.includes('حذف مشتری'))throw Error('legacy actions');
 }
 document.getElementById('result').textContent='CREDIT_MENU_PASS';
}catch(e){document.getElementById('result').textContent='CREDIT_MENU_FAIL '+e.message}
</script></body></html>"""
        )
        html = html.replace(
            "<body>",
            '<link rel="stylesheet" href="'
            + (root / "assets/order-action-burger-v1.css").as_uri()
            + '"><style>.order-menu.customer-menu{background:#fff!important}.customer-menu button{background:#fff!important;color:#111!important}</style><body>',
        )
        html = html.replace(
            "fillOpsMenu(42);fillOpsMenu(42);",
            "fillOpsMenu(42);fillOpsMenu(42);if(getComputedStyle(menu).backgroundColor!=='rgb(16, 42, 67)')throw Error('navy');menu.querySelectorAll('button').forEach(b=>b.style.setProperty('transition','none','important'));menu.querySelector('button').focus();if(getComputedStyle(menu.querySelector('button')).backgroundColor!=='rgb(245, 130, 32)')throw Error('orange');if(getComputedStyle(menu.querySelectorAll('button')[1]).filter!=='blur(1px)')throw Error('blur');",
        )
        browser = shutil.which("google-chrome") or shutil.which("chromium")
        if not browser:
            raise RuntimeError("Chrome is required")
        with tempfile.TemporaryDirectory() as directory:
            fixture = Path(directory) / "menu.html"
            fixture.write_text(html)
            result = subprocess.run(
                [
                    browser,
                    "--headless=new",
                    "--no-sandbox",
                    "--disable-gpu",
                    "--allow-file-access-from-files",
                    "--dump-dom",
                    fixture.as_uri(),
                ],
                capture_output=True,
                text=True,
                check=True,
            )
            if "CREDIT_MENU_PASS</output>" not in result.stdout:
                raise RuntimeError("Customer menu renderer failed")
        print(
            "PASS: actual customer menu visibility, role restriction and selected identity"
        )


if __name__ == "__main__":
    CreditMenuRendererCheck().run()
