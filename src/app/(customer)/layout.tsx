import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";

export default function CustomerLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
