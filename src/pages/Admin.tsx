import { useState, useEffect } from "react";
import { 
  Package, 
  Globe, 
  Settings, 
  TrendingUp, 
  Search,
  Filter,
  MoreHorizontal,
  Download,
  QrCode,
  Clock,
  Loader2,
  Copy,
  Check
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { toast } from "sonner";

const AdminDashboard = () => {
  const [activeTab, setStatusFilter] = useState("all");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const password = sessionStorage.getItem("qonnect-admin-pw");
      const response = await fetch("/api/admin/orders", {
        headers: password ? { "x-admin-password": password } : {}
      });

      if (response.status === 401) {
        const input = prompt("Access Restricted. Enter Command Center Password:");
        if (input) {
          sessionStorage.setItem("qonnect-admin-pw", input);
          fetchOrders();
        }
        return;
      }

      if (!response.ok) throw new Error("Failed to fetch orders");
      const data = await response.json();
      setOrders(data);
    } catch (err) {
      toast.error("Could not load real-time order data.");
    } finally {
      setLoading(false);
    }
  };

  const copyForSupplier = (order: any) => {
    const intake = order.intake?.entries?.[0]; // Support first item for now
    if (!intake) {
      toast.error("Customer hasn't completed intake yet.");
      return;
    }

    const summary = `
QONNECT ORDER SUMMARY
---------------------
Order ID: #${order.sessionId.slice(-6).toUpperCase()}
Customer: ${order.contactEmail}
Edition: ${order.items[0].title}
Tier: ${order.items[0].tier.toUpperCase()}
Print Mode: ${intake.mode.toUpperCase()}
Target URL: ${intake.targetUrl}
QR Slug: ${intake.mode === 'bridge' ? `qonnect.ai/b/${intake.slug}` : 'DIRECT'}
---------------------
    `.trim();

    navigator.clipboard.writeText(summary);
    setCopiedId(order.sessionId);
    toast.success("Order copied for supplier handoff.");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      
      <main className="flex-1 flex flex-col lg:flex-row">
        {/* Sidebar */}
        <aside className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-border p-6 space-y-2">
          <p className="eyebrow text-[10px] mb-6 px-3">Filter status</p>
          {['all', 'ready_to_print', 'intake_required', 'shipped'].map(status => (
            <button 
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 nav-text text-[11px] transition-all duration-300 ${activeTab === status ? 'bg-foreground/5 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Package className="w-4 h-4" /> {status.replace('_', ' ')}
            </button>
          ))}
        </aside>

        {/* Content */}
        <div className="flex-1 p-6 md:p-10 lg:p-16 max-w-7xl">
          <header className="flex justify-between items-end mb-12">
            <div>
              <p className="eyebrow mb-2">Live Fulfillment Queue</p>
              <h1 className="display-md">Command <em className="italic">Center.</em></h1>
            </div>
          </header>

          {loading ? (
            <div className="py-32 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="border border-border overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-foreground/[0.02] border-b border-border">
                    <tr>
                      <th className="p-4 nav-text text-[10px] text-muted-foreground">Order</th>
                      <th className="p-4 nav-text text-[10px] text-muted-foreground">Customer</th>
                      <th className="p-4 nav-text text-[10px] text-muted-foreground">Edition</th>
                      <th className="p-4 nav-text text-[10px] text-muted-foreground">Identity Mode</th>
                      <th className="p-4 nav-text text-[10px] text-muted-foreground">Status</th>
                      <th className="p-4 nav-text text-[10px] text-muted-foreground text-right">Handoff</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-20 text-center text-muted-foreground italic font-serif">No orders in the system yet.</td>
                      </tr>
                    ) : orders.map((order) => (
                      <tr key={order.sessionId} className="group hover:bg-foreground/[0.01] transition-colors duration-300">
                        <td className="p-4 font-serif text-sm">#{order.sessionId.slice(-6).toUpperCase()}</td>
                        <td className="p-4">
                          <div className="text-sm font-medium">{order.contactEmail || "In Progress..."}</div>
                        </td>
                        <td className="p-4">
                          <div className="text-[10px] uppercase tracking-widest">{order.items[0].title}</div>
                          <div className="text-[10px] text-primary/60 tracking-tighter">{order.items[0].tier}</div>
                        </td>
                        <td className="p-4">
                          <div className="text-[10px] font-mono">
                            {order.intake?.entries?.[0]?.mode === 'bridge' ? (
                              <span className="text-primary">BRIDGE: {order.intake.entries[0].slug}</span>
                            ) : order.intake?.entries?.[0]?.targetUrl ? (
                              <span className="text-muted-foreground">DIRECT</span>
                            ) : (
                              <span className="opacity-30 italic">Intake pending...</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 text-[9px] uppercase tracking-tighter border ${
                            order.intake ? 'border-primary/50 text-primary' : 'border-muted-foreground/30 text-muted-foreground'
                          }`}>
                            {order.intake ? 'ready to print' : 'waiting for intake'}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button 
                            onClick={() => copyForSupplier(order)}
                            className="btn-transparent !py-2 !px-3 text-[9px]"
                            disabled={!order.intake}
                          >
                            {copiedId === order.sessionId ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                            Supplier Copy
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AdminDashboard;
