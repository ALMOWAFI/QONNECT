import { useState, useEffect } from "react";
import {
  Package,
  Download,
  Loader2,
  Copy,
  Check,
  Image as ImageIcon,
  Mail,
  Link,
  X,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { toast } from "sonner";

const AdminDashboard = () => {
  const [activeTab, setStatusFilter] = useState("all");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [notifyingId, setNotifyingId] = useState<string | null>(null);
  const [liveUrlModal, setLiveUrlModal] = useState<{ slug: string; sessionId: string } | null>(null);
  const [liveUrl, setLiveUrl] = useState("");
  const [settingLiveUrl, setSettingLiveUrl] = useState(false);

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
Order ID: #${order.shortOrderId}
Customer: ${order.customerEmail}
Edition: ${order.items[0].title}
Tier: ${order.items[0].tier.toUpperCase()}
Print Mode: ${intake.mode.toUpperCase()}
Target URL: ${intake.targetUrl}
QR Slug: ${intake.mode === 'bridge' ? 'qonnect.ai/b/' + intake.slug : 'DIRECT'}
---------------------
    `.trim();

    navigator.clipboard.writeText(summary);
    setCopiedId(order.sessionId);
    toast.success("Order copied for supplier handoff.");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const generateAsset = async (sessionId: string) => {
    setGeneratingId(sessionId);
    try {
      const password = sessionStorage.getItem("qonnect-admin-pw");
      const response = await fetch(`/api/admin/orders/${sessionId}/generate-asset`, {
        method: 'POST',
        headers: password ? { "x-admin-password": password } : {}
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to generate asset");
      }
      
      const data = await response.json();
      toast.success("Print asset generated successfully!");
      fetchOrders(); // Refresh the list to show the new asset link
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGeneratingId(null);
    }
  };

  const notifySupplier = async (sessionId: string) => {
    const email = prompt("Supplier email address:");
    if (!email) return;
    setNotifyingId(sessionId);
    try {
      const password = sessionStorage.getItem("qonnect-admin-pw");
      const response = await fetch(`/api/admin/orders/${sessionId}/notify-supplier`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(password ? { "x-admin-password": password } : {})
        },
        body: JSON.stringify({ supplierEmail: email })
      });
      if (!response.ok) throw new Error((await response.json()).error);
      toast.success(`Supplier notified at ${email}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to notify supplier.");
    } finally {
      setNotifyingId(null);
    }
  };

  const setLiveUrlForBridge = async () => {
    if (!liveUrlModal || !liveUrl) return;
    setSettingLiveUrl(true);
    try {
      const password = sessionStorage.getItem("qonnect-admin-pw");
      const response = await fetch(`/api/admin/bridges/${liveUrlModal.slug}/destination`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(password ? { "x-admin-password": password } : {})
        },
        body: JSON.stringify({ targetUrl: liveUrl, notifyCustomer: true })
      });
      if (!response.ok) throw new Error((await response.json()).error);
      toast.success("Bridge updated and customer notified.");
      setLiveUrlModal(null);
      setLiveUrl("");
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || "Failed to update bridge.");
    } finally {
      setSettingLiveUrl(false);
    }
  };

  const updateStatus = async (sessionId: string, newStatus: string) => {
    try {
      const password = sessionStorage.getItem("qonnect-admin-pw");
      const response = await fetch(`/api/admin/orders/${sessionId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(password ? { "x-admin-password": password } : {})
        },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (!response.ok) throw new Error("Failed to update status");
      
      toast.success("Status updated!");
      fetchOrders();
    } catch (err) {
      toast.error("Could not update order status.");
    }
  };

  const filteredOrders = activeTab === "all" 
    ? orders 
    : orders.filter(o => o.status === activeTab || (activeTab === 'intake_required' && !o.intake) || (activeTab === 'ready_to_print' && o.intake && o.status !== 'shipped' && o.status !== 'printing' && o.status !== 'delivered'));

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      
      <main className="flex-1 flex flex-col lg:flex-row">
        {/* Sidebar */}
        <aside className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-border p-6 space-y-2">
          <p className="eyebrow text-[10px] mb-6 px-3">Filter status</p>
          {['all', 'pending_payment', 'intake_required', 'ready_to_print', 'printing', 'shipped'].map(status => (
            <button 
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 nav-text text-[11px] transition-all duration-300 ${activeTab === status ? 'bg-foreground/5 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Package className="w-4 h-4" /> {status.replace(/_/g, ' ')}
            </button>
          ))}
        </aside>

        {/* Content */}
        <div className="flex-1 p-6 md:p-10 lg:p-16 max-w-7xl overflow-x-auto">
          <header className="flex justify-between items-end mb-12">
            <div>
              <p className="eyebrow mb-2">Live Fulfillment Queue</p>
              <h1 className="display-md">Command <em className="italic">Center.</em></h1>
            </div>
            <button onClick={fetchOrders} className="btn-transparent !py-2 !px-4 text-[10px]">
              Refresh Data
            </button>
          </header>

          {loading ? (
            <div className="py-32 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="border border-border overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead className="bg-foreground/[0.02] border-b border-border">
                    <tr>
                      <th className="p-4 nav-text text-[10px] text-muted-foreground">Order</th>
                      <th className="p-4 nav-text text-[10px] text-muted-foreground">Customer</th>
                      <th className="p-4 nav-text text-[10px] text-muted-foreground">Edition</th>
                      <th className="p-4 nav-text text-[10px] text-muted-foreground">Identity Mode</th>
                      <th className="p-4 nav-text text-[10px] text-muted-foreground">Status & Actions</th>
                      <th className="p-4 nav-text text-[10px] text-muted-foreground text-right">Fulfillment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-20 text-center text-muted-foreground italic font-serif">No orders match this filter.</td>
                      </tr>
                    ) : filteredOrders.map((order) => (
                      <tr key={order.sessionId} className="group hover:bg-foreground/[0.01] transition-colors duration-300">
                        <td className="p-4 font-serif text-sm">#{order.shortOrderId}</td>
                        <td className="p-4">
                          <div className="text-sm font-medium">{order.customerEmail || "In Progress..."}</div>
                        </td>
                        <td className="p-4">
                          <div className="text-[10px] uppercase tracking-widest">{order.items[0]?.title?.split('Edition')[0] || 'Signature'}</div>
                          <div className="text-[10px] text-primary/60 tracking-tighter">{order.items[0]?.tier}</div>
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
                          <div className="flex flex-col gap-2 items-start">
                            <select 
                              value={order.status?.state || order.status || 'pending_payment'} 
                              onChange={(e) => updateStatus(order.sessionId, e.target.value)}
                              className={`px-2 py-1 text-[9px] uppercase tracking-tighter border bg-transparent outline-none cursor-pointer ${
                                (order.status?.state || order.status) === 'ready_to_print' ? 'border-primary/50 text-primary' : 
                                (order.status?.state || order.status) === 'shipped' ? 'border-green-500/50 text-green-500' :
                                'border-muted-foreground/30 text-muted-foreground hover:border-foreground/50'
                              }`}
                            >
                              <option value="pending_payment" className="bg-background text-foreground">Pending Payment</option>
                              <option value="intake_required" className="bg-background text-foreground">Intake Required</option>
                              <option value="ready_to_print" className="bg-background text-foreground">Ready to Print</option>
                              <option value="printing" className="bg-background text-foreground">Printing</option>
                              <option value="shipped" className="bg-background text-foreground">Shipped</option>
                              <option value="delivered" className="bg-background text-foreground">Delivered</option>
                            </select>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2 flex-wrap">
                            {/* Copy for supplier (clipboard) */}
                            <button
                              onClick={() => copyForSupplier(order)}
                              className="btn-transparent !py-2 !px-3 text-[9px]"
                              disabled={!order.intake}
                              title="Copy details for supplier"
                            >
                              {copiedId === order.sessionId ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            </button>

                            {/* Generate or download print file */}
                            {order.printAssetUrl ? (
                              <a
                                href={order.printAssetUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-filled !py-2 !px-3 text-[9px] bg-primary text-primary-foreground"
                                title="Download Print File"
                              >
                                <Download className="w-3 h-3" />
                              </a>
                            ) : (
                              <button
                                onClick={() => generateAsset(order.sessionId)}
                                className="btn-filled !py-2 !px-3 text-[9px]"
                                disabled={!order.intake || generatingId === order.sessionId}
                                title="Auto-Composite Print File"
                              >
                                {generatingId === order.sessionId ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
                              </button>
                            )}

                            {/* Notify supplier by email */}
                            {order.printAssetUrl && (
                              <button
                                onClick={() => notifySupplier(order.sessionId)}
                                disabled={notifyingId === order.sessionId}
                                className="btn-transparent !py-2 !px-3 text-[9px]"
                                title="Email print file to supplier"
                              >
                                {notifyingId === order.sessionId ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                              </button>
                            )}

                            {/* Set live URL for premium #pending-build orders */}
                            {order.intake?.entries?.[0]?.targetUrl === '#pending-build' && order.intake?.entries?.[0]?.slug && (
                              <button
                                onClick={() => {
                                  setLiveUrlModal({ slug: order.intake.entries[0].slug, sessionId: order.sessionId });
                                  setLiveUrl("");
                                }}
                                className="btn-transparent !py-2 !px-3 text-[9px] border-primary/40 text-primary"
                                title="Set live URL for this premium page"
                              >
                                <Link className="w-3 h-3" />
                              </button>
                            )}
                          </div>
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

      {/* Set Live URL modal */}
      {liveUrlModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-background border border-border w-full max-w-md p-8 space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="eyebrow text-[10px] mb-1">Set Live URL</p>
                <h2 className="text-lg font-light">Bridge: <span className="font-medium">{liveUrlModal.slug}</span></h2>
              </div>
              <button onClick={() => setLiveUrlModal(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Final destination URL</label>
              <input
                type="url"
                value={liveUrl}
                onChange={e => setLiveUrl(e.target.value)}
                placeholder="https://custompage.qonnect.work/..."
                className="w-full bg-transparent border border-border px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-foreground/50 transition-colors"
                autoFocus
              />
              <p className="text-[10px] text-muted-foreground">Customer will be notified by email that their page is live.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setLiveUrlModal(null)}
                className="flex-1 btn-transparent !py-2 text-[10px]"
              >Cancel</button>
              <button
                onClick={setLiveUrlForBridge}
                disabled={!liveUrl || settingLiveUrl}
                className="flex-1 btn-filled !py-2 text-[10px]"
              >
                {settingLiveUrl ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "Set Live & Notify"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default AdminDashboard;
