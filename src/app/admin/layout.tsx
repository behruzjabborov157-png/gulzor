import { PanelShell } from "@/components/admin/panel-shell";

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <PanelShell>{children}</PanelShell>;
}
