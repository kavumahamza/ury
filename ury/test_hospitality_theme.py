"""Rendered staff-page appearance opt-in; no bench or live site required."""

import json
import subprocess

from ury.test_brand import PageParser, ScriptParser, TestSiteBrand


class TestHospitalityTheme(TestSiteBrand):
    def test_staff_pages_render_only_the_fixed_opt_in(self):
        self.set_staff_brand()
        for selection in (None, "", "off", "https://example.invalid/theme.css", {}, "hospitality"):
            self.framework.conf["ury_hospitality_theme"] = selection
            for page in ("pos", "urypos", "mosaic"):
                with self.subTest(selection=selection, page=page):
                    context = self.context(page)
                    html = self.render(page, context)
                    self.assertEqual('data-ury-theme="hospitality"' in html, selection == "hospitality")
                    parser = ScriptParser(html)
                    result = subprocess.run([
                        "node", "-e", "global.window=global;" + parser.inline[0]
                        + ";process.stdout.write(JSON.stringify(window.frappe.boot.ury_hospitality_theme ?? null));",
                    ], text=True, capture_output=True, check=True)
                    self.assertEqual(json.loads(result.stdout), "hospitality" if selection == "hospitality" else None)
                    self.assertEqual(PageParser(html).title, self.hooks["name"][-1])

    def test_guest_order_and_default_context_do_not_inherit_staff_appearance(self):
        self.framework.conf["ury_hospitality_theme"] = "hospitality"
        self.assertIsNone(self.brand_module().get_brand_context().get("hospitality_theme"))
        html = self.render("order", self.context("order"))
        self.assertNotIn('data-ury-theme="hospitality"', html)
        boot = json.loads(json.loads(self.context("order")["boot"]))
        self.assertIsNone(boot.get("ury_hospitality_theme"))

    def test_authenticated_and_developer_pos_boot_keep_the_same_selection(self):
        self.framework.session.user = "cashier@example.com"
        self.framework.conf["ury_hospitality_theme"] = "hospitality"
        controller = __import__("ury.www.pos", fromlist=["get_boot"])
        for boot in (self.context("pos")["boot"], controller.get_boot()):
            self.assertEqual(json.loads(json.loads(boot)).get("ury_hospitality_theme"), "hospitality")
