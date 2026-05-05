import { useState, useEffect, useMemo } from "react";
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
  Plus,
  Trash2,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { toast } from "sonner";
import { BusinessTemplate } from "@/components/templates/BusinessTemplate";
import { TechTemplate } from "@/components/templates/TechTemplate";
import { MedTemplate } from "@/components/templates/MedTemplate";
import type { TemplateData } from "@/components/templates/TechTemplate";

const AdminDashboard = () => {
  const [activeTab, setStatusFilter] = useState("all");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [notifyingId, setNotifyingId] = useState<string | null>(null);
  const [shippingModal, setShippingModal] = useState<any | null>(null);

  // Page builder modal
  const [builderModal, setBuilderModal] = useState<{ slug: string; sessionId: string } | null>(null);
  const [builderTab, setBuilderTab] = useState<'page' | 'redirect'>('page');
  const [builderName, setBuilderName] = useState('');
  const [builderTitle, setBuilderTitle] = useState('');
  const [builderBio, setBuilderBio] = useState('');
  const [builderEdition, setBuilderEdition] = useState<'business' | 'tech' | 'medical'>('business');
  const [builderLinks, setBuilderLinks] = useState<{ title: string; url: string }[]>([{ title: '', url: '' }]);
  const [builderRedirectUrl, setBuilderRedirectUrl] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

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

    const item = order.items[0];
    const size = item.selectedOptions?.find((o: any) => o.name === 'Size')?.value || 'N/A';

    const summary = `
QONNECT ORDER SUMMARY
---------------------
Order ID: #${order.shortOrderId}
Customer: ${order.customerEmail}
Edition: ${item.title}
Size: ${size}
Tier: ${item.tier.toUpperCase()}
Print Mode: ${intake.mode.toUpperCase()}
Target URL: ${intake.targetUrl}
QR Slug: ${intake.mode === 'bridge' ? 'qonnect.work/b/' + intake.slug : 'DIRECT'}

SHIPPING ADDRESS:
${order.shipping?.name || 'No name'}
${order.shipping?.address?.line1 || ''}
${order.shipping?.address?.line2 || ''}
${order.shipping?.address?.city || ''}, ${order.shipping?.address?.state || ''} ${order.shipping?.address?.postal_code || ''}
${order.shipping?.address?.country || ''}
---------------------
    `.trim();

    navigator.clipboard.writeText(summary);
    setCopiedId(order.sessionId);
    toast.success("Order & Shipping details copied for supplier.");
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

  const openBuilder = (slug: string, sessionId: string) => {
    setBuilderModal({ slug, sessionId });
    setBuilderTab('page');
    setBuilderName('');
    setBuilderTitle('');
    setBuilderBio('');
    setBuilderEdition('business');
    setBuilderLinks([{ title: '', url: '' }]);
    setBuilderRedirectUrl('');
    setShowPreview(false);
  };

  const publishTemplate = async () => {
    if (!builderModal) return;
    setPublishing(true);
    try {
      const password = sessionStorage.getItem("qonnect-admin-pw");
      if (builderTab === 'redirect') {
        if (!builderRedirectUrl) { toast.error('Enter a URL.'); return; }
        const res = await fetch(`/api/admin/bridges/${builderModal.slug}/destination`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...(password ? { "x-admin-password": password } : {}) },
          body: JSON.stringify({ targetUrl: builderRedirectUrl, notifyCustomer: true }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        toast.success("Redirect set and customer notified.");
      } else {
        if (!builderName.trim()) { toast.error('Name is required.'); return; }
        const validLinks = builderLinks.filter(l => l.title && l.url);
        const res = await fetch(`/api/admin/bridges/${builderModal.slug}/template`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...(password ? { "x-admin-password": password } : {}) },
          body: JSON.stringify({
            name: builderName.trim(),
            title: builderTitle.trim(),
            bio: builderBio.trim(),
            edition: builderEdition,
            links: validLinks,
            notifyCustomer: true,
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        toast.success("Page published and customer notified.");
      }
      setBuilderModal(null);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || "Failed to publish.");
    } finally {
      setPublishing(false);
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
                          <div className="flex flex-col gap-1">
                            <div className="text-sm font-medium">{order.customerEmail || "In Progress..."}</div>
                            {order.shipping && (
                              <button 
                                onClick={() => setShippingModal(order.shipping)}
                                className="text-[9px] uppercase tracking-wider text-primary/70 hover:text-primary text-left"
                              >
                                View Shipping Address
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="text-[10px] uppercase tracking-widest">{order.items[0]?.title?.split('Edition')[0] || 'Signature'}</div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-primary/60 tracking-tighter uppercase">{order.items[0]?.tier}</span>
                            <span className="text-[10px] px-1.5 py-0.5 border border-border bg-foreground/5 font-bold">{order.items[0]?.selectedOptions?.find((o: any) => o.name === 'Size')?.value || '?'}</span>
                          </div>
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

                            {/* Page builder for premium #pending-build orders */}
                            {order.intake?.entries?.[0]?.targetUrl === '#pending-build' && order.intake?.entries?.[0]?.slug && (
                              <button
                                onClick={() => openBuilder(order.intake.entries[0].slug, order.sessionId)}
                                className="btn-transparent !py-2 !px-3 text-[9px] border-primary/40 text-primary"
                                title="Build & publish customer page"
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

      {/* Shipping Address Modal */}
      {shippingModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-background border border-border w-full max-w-md p-8 space-y-6 animate-in zoom-in duration-300">
            <div className="flex justify-between items-start">
              <div>
                <p className="eyebrow text-[10px] mb-1">Logistics</p>
                <h2 className="text-xl font-serif italic">Shipping Destination</h2>
              </div>
              <button onClick={() => setShippingModal(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-4 border-l border-primary/20 pl-6 py-2">
              <p className="text-lg font-medium">{shippingModal.name}</p>
              <div className="space-y-1 text-sm text-muted-foreground font-mono">
                <p>{shippingModal.address?.line1}</p>
                {shippingModal.address?.line2 && <p>{shippingModal.address.line2}</p>}
                <p>{shippingModal.address?.city}, {shippingModal.address?.state} {shippingModal.address?.postal_code}</p>
                <p className="uppercase tracking-widest pt-2 text-[10px] text-primary/60">{shippingModal.address?.country}</p>
              </div>
            </div>

            <button
              onClick={() => setShippingModal(null)}
              className="w-full btn-filled !py-3 text-[10px]"
            >Close Record</button>
          </div>
        </div>
      )}

      {/* Page Builder Modal */}
      {builderModal && (() => {
        const previewData: TemplateData = {
          slug: builderModal.slug,
          brief: [builderName, builderTitle, builderBio].filter(Boolean).join('\n'),
          targetUrl: builderLinks.find(l => l.url)?.url || '#',
          destinationType: 'custom-page',
          edition: builderEdition,
          contactEmail: null,
          links: builderLinks.filter(l => l.title && l.url),
        };

        return (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
            <div className="bg-background border border-border w-full max-w-5xl my-4 animate-in zoom-in-95 duration-300">
              {/* Header */}
              <div className="flex items-center justify-between px-8 py-5 border-b border-border">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-0.5">Page Builder</p>
                  <h2 className="text-lg font-light">Bridge: <span className="font-mono text-primary">{builderModal.slug}</span></h2>
                </div>
                <button onClick={() => setBuilderModal(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-border">
                {(['page', 'redirect'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setBuilderTab(tab)}
                    className={`px-6 py-3 text-[10px] uppercase tracking-[0.2em] transition-colors border-b-2 -mb-px ${
                      builderTab === tab
                        ? 'border-primary text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tab === 'page' ? 'Build Custom Page' : 'Redirect to URL'}
                  </button>
                ))}
              </div>

              {builderTab === 'redirect' ? (
                <div className="p-8 space-y-6 max-w-lg">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Destination URL</label>
                    <input
                      type="url"
                      value={builderRedirectUrl}
                      onChange={e => setBuilderRedirectUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-transparent border border-border px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-foreground/50 transition-colors"
                      autoFocus
                    />
                    <p className="text-[10px] text-muted-foreground">Customer will be notified when you publish.</p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setBuilderModal(null)} className="flex-1 btn-transparent !py-2 text-[10px]">Cancel</button>
                    <button
                      onClick={publishTemplate}
                      disabled={!builderRedirectUrl || publishing}
                      className="flex-1 btn-filled !py-2 text-[10px]"
                    >
                      {publishing ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : 'Set Live & Notify'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col lg:flex-row">
                  {/* Form panel */}
                  <div className="flex-none lg:w-80 xl:w-96 border-b lg:border-b-0 lg:border-r border-border p-6 space-y-5 overflow-y-auto max-h-[70vh] lg:max-h-none">
                    {/* Edition */}
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Edition</label>
                      <div className="flex gap-2">
                        {(['business', 'tech', 'medical'] as const).map(ed => (
                          <button
                            key={ed}
                            onClick={() => setBuilderEdition(ed)}
                            className={`flex-1 py-2 text-[9px] uppercase tracking-[0.15em] border transition-colors ${
                              builderEdition === ed
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border text-muted-foreground hover:border-foreground/30'
                            }`}
                          >
                            {ed}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Name */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        Name <span className="text-destructive">*</span>
                      </label>
                      <input
                        value={builderName}
                        onChange={e => setBuilderName(e.target.value)}
                        placeholder={builderEdition === 'tech' ? 'Alex Chen' : builderEdition === 'medical' ? 'Dr. Sarah Kim' : 'Jordan Miller'}
                        className="w-full bg-transparent border-b border-border py-2 text-sm focus:outline-none focus:border-foreground/50 transition-colors placeholder:text-muted-foreground/30"
                        autoFocus
                      />
                    </div>

                    {/* Title */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        {builderEdition === 'tech' ? 'Role / Stack' : builderEdition === 'medical' ? 'Specialty' : 'Title / Role'}
                      </label>
                      <input
                        value={builderTitle}
                        onChange={e => setBuilderTitle(e.target.value)}
                        placeholder={builderEdition === 'tech' ? 'Senior Engineer · React / Go' : builderEdition === 'medical' ? 'Cardiology · FACC' : 'Head of Strategy'}
                        className="w-full bg-transparent border-b border-border py-2 text-sm focus:outline-none focus:border-foreground/50 transition-colors placeholder:text-muted-foreground/30"
                      />
                    </div>

                    {/* Bio */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Bio</label>
                      <textarea
                        value={builderBio}
                        onChange={e => setBuilderBio(e.target.value)}
                        placeholder="A short description that appears on the card…"
                        rows={3}
                        className="w-full bg-transparent border border-border px-3 py-2 text-sm resize-none focus:outline-none focus:border-foreground/50 transition-colors placeholder:text-muted-foreground/30"
                      />
                    </div>

                    {/* Links */}
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Links</label>
                      <div className="space-y-2">
                        {builderLinks.map((link, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <input
                              value={link.title}
                              onChange={e => {
                                const updated = [...builderLinks];
                                updated[idx] = { ...updated[idx], title: e.target.value };
                                setBuilderLinks(updated);
                              }}
                              placeholder="Label"
                              className="w-24 bg-transparent border-b border-border py-1.5 text-xs focus:outline-none focus:border-foreground/50 transition-colors placeholder:text-muted-foreground/30"
                            />
                            <input
                              value={link.url}
                              onChange={e => {
                                const updated = [...builderLinks];
                                updated[idx] = { ...updated[idx], url: e.target.value };
                                setBuilderLinks(updated);
                              }}
                              placeholder="https://..."
                              className="flex-1 bg-transparent border-b border-border py-1.5 text-xs font-mono focus:outline-none focus:border-foreground/50 transition-colors placeholder:text-muted-foreground/30"
                            />
                            <button
                              onClick={() => setBuilderLinks(prev => prev.filter((_, i) => i !== idx))}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => setBuilderLinks(prev => [...prev, { title: '', url: '' }])}
                        className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors mt-1"
                      >
                        <Plus className="w-3 h-3" /> Add Link
                      </button>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                      <button onClick={() => setBuilderModal(null)} className="flex-1 btn-transparent !py-2 text-[10px]">Cancel</button>
                      <button
                        onClick={publishTemplate}
                        disabled={!builderName.trim() || publishing}
                        className="flex-1 btn-filled !py-2 text-[10px]"
                      >
                        {publishing ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : 'Publish & Notify'}
                      </button>
                    </div>
                  </div>

                  {/* Live Preview panel */}
                  <div className="flex-1 bg-[#0a0a0a] flex flex-col items-center justify-start p-6 min-h-[400px] lg:min-h-0 overflow-hidden relative">
                    <p className="text-[9px] uppercase tracking-[0.3em] text-white/20 mb-4 self-start">Live Preview</p>
                    <div className="relative w-full flex justify-center overflow-hidden" style={{ height: '520px' }}>
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: '50%',
                          transform: 'translateX(-50%) scale(0.72)',
                          transformOrigin: 'top center',
                          width: '375px',
                          pointerEvents: 'none',
                        }}
                      >
                        {builderEdition === 'tech'
                          ? <TechTemplate data={previewData} />
                          : builderEdition === 'medical'
                          ? <MedTemplate data={previewData} />
                          : <BusinessTemplate data={previewData} />
                        }
                      </div>
                    </div>
                    <p className="text-[9px] text-white/10 mt-2 tracking-widest">Updates as you type</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <Footer />
    </div>
  );
};

export default AdminDashboard;
