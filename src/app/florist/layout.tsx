import { PanelShell } from "@/components/admin/panel-shell";

export default function FloristRootLayout({ children }: { children: React.ReactNode }) {
  return <PanelShell>{children}</PanelShell>;
}
