import { useState } from "react";
import { 
  LayoutDashboard, 
  Package, 
  Globe, 
  Settings, 
  TrendingUp, 
  Search,
  Filter,
  MoreHorizontal,
  ChevronRight,
  Download,
  QrCode,
  Clock
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

// Mock Data for the Command Center
const mockOrders = [
  { id: "1024", customer: "Ali Elmowafi", edition: "Robotics", tier: "Premium", status: "ready_to_print", slug: "ali-777", date: "2026-05-03" },
  { id: "1023", customer: "Sarah Chen", edition: "Medicine", tier: "Standard", status: "intake_required", slug: "pending", date: "2026-05-02" },
  { id: "1022", customer: "James Blake", edition: "Tech", tier: "Basic", status: "shipped", slug: "jblake", date: "2026-05-01" },
];

const StatCard = ({ label, value, icon: Icon, trend }: any) => (
  <div className="bg-background border border-border p-6 hover:border-primary/50 transition-all duration-500 group active:scale-[0.98]">
    <div className="flex justify-between items-start mb-4">
      <p className="eyebrow text-[10px]">{label}</p>
      <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
    </div>
    <div className="flex items-baseline gap-3">
      <h3 className="display text-3xl font-medium">{value}</h3>
      {trend && <span className="text-[10px] text-primary/60 tracking-tighter">{trend}</span>}
    </div>
  </div>
);

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState("orders");

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      
      <main className="flex-1 flex flex-col lg:flex-row">
        {/* Sidebar */}
        <aside className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-border p-6 space-y-2">
          <p className="eyebrow text-[10px] mb-6 px-3">System Ops</p>
          <button 
            onClick={() => setActiveTab("orders")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 nav-text text-[11px] transition-all duration-300 ${activeTab === 'orders' ? 'bg-foreground/5 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Package className="w-4 h-4" /> Orders
          </button>
          <button 
            onClick={() => setActiveTab("bridges")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 nav-text text-[11px] transition-all duration-300 ${activeTab === 'bridges' ? 'bg-foreground/5 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Globe className="w-4 h-4" /> Bridges
          </button>
          <button 
            className={`w-full flex items-center gap-3 px-3 py-2.5 nav-text text-[11px] text-muted-foreground hover:text-foreground transition-all duration-300`}
          >
            <TrendingUp className="w-4 h-4" /> Analytics
          </button>
          <button 
            className={`w-full flex items-center gap-3 px-3 py-2.5 nav-text text-[11px] text-muted-foreground hover:text-foreground transition-all duration-300`}
          >
            <Settings className="w-4 h-4" /> Settings
          </button>
        </aside>

        {/* Content */}
        <div className="flex-1 p-6 md:p-10 lg:p-16 max-w-7xl">
          <header className="flex justify-between items-end mb-12">
            <div>
              <p className="eyebrow mb-2">Operational View</p>
              <h1 className="display-md">Command <em className="italic">Center.</em></h1>
            </div>
            <div className="flex gap-3">
              <button className="btn-transparent !py-2 !px-4 text-[10px]">
                <Download className="w-3 h-3 mr-2" /> Export
              </button>
              <button className="btn-filled !py-2 !px-4 text-[10px]">
                New Order
              </button>
            </div>
          </header>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            <StatCard label="Active Orders" value="24" icon={Package} trend="+12% vs last week" />
            <StatCard label="Total Scans" value="1.2k" icon={TrendingUp} trend="High activity" />
            <StatCard label="Avg. Fulfillment" value="3.2d" icon={Clock} />
          </div>

          {/* Table Area */}
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between gap-4">
              <div className="relative flex-1 max-w-md group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input 
                  placeholder="Search by customer or slug..."
                  className="w-full bg-background border border-border py-2.5 pl-10 pr-4 text-xs font-serif focus:outline-none focus:border-foreground/50 transition-all"
                />
              </div>
              <div className="flex gap-2">
                <button className="flex items-center gap-2 px-4 py-2 border border-border text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground transition-all">
                  <Filter className="w-3 h-3" /> Status
                </button>
              </div>
            </div>

            <div className="border border-border overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-foreground/[0.02] border-b border-border">
                  <tr>
                    <th className="p-4 nav-text text-[10px] text-muted-foreground">Order ID</th>
                    <th className="p-4 nav-text text-[10px] text-muted-foreground">Customer</th>
                    <th className="p-4 nav-text text-[10px] text-muted-foreground">Edition/Tier</th>
                    <th className="p-4 nav-text text-[10px] text-muted-foreground">Status</th>
                    <th className="p-4 nav-text text-[10px] text-muted-foreground">Bridge</th>
                    <th className="p-4 nav-text text-[10px] text-muted-foreground text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {mockOrders.map((order) => (
                    <tr key={order.id} className="group hover:bg-foreground/[0.01] transition-colors duration-300">
                      <td className="p-4 font-serif text-sm">#{order.id}</td>
                      <td className="p-4">
                        <div className="text-sm font-medium">{order.customer}</div>
                        <div className="text-[10px] text-muted-foreground font-serif italic">{order.date}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-[10px] uppercase tracking-widest">{order.edition}</div>
                        <div className="text-[10px] text-primary/60 tracking-tighter">{order.tier}</div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 text-[9px] uppercase tracking-tighter border ${
                          order.status === 'ready_to_print' ? 'border-primary/50 text-primary' : 
                          order.status === 'shipped' ? 'border-green-500/50 text-green-500' :
                          'border-muted-foreground/30 text-muted-foreground'
                        }`}>
                          {order.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-[10px] text-muted-foreground">
                        {order.slug === 'pending' ? <span className="opacity-30">...</span> : `/b/${order.slug}`}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button className="p-2 text-muted-foreground hover:text-primary transition-colors active:scale-90" title="Generate Asset">
                            <QrCode className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-muted-foreground hover:text-foreground transition-colors active:scale-90">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="flex justify-between items-center pt-4">
              <p className="text-[10px] text-muted-foreground italic font-serif">Showing {mockOrders.length} of 124 orders</p>
              <div className="flex gap-1">
                {[1, 2, 3].map(n => (
                  <button key={n} className={`w-8 h-8 text-[10px] border border-border flex items-center justify-center transition-all ${n === 1 ? 'bg-foreground text-background' : 'hover:border-foreground'}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AdminDashboard;
