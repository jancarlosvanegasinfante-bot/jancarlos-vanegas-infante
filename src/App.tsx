import { motion, AnimatePresence } from "motion/react";
import toast, { Toaster } from "react-hot-toast";
import { 
  MessageSquare, 
  Settings, 
  CheckCircle, 
  ExternalLink, 
  Copy, 
  Zap, 
  ShoppingBag, 
  Phone, 
  Cpu, 
  DollarSign, 
  ChevronRight, 
  Database, 
  Truck, 
  Box, 
  TrendingUp,
  Package,
  Clock,
  User,
  MapPin,
  RefreshCw,
  Plus,
  LogOut,
  AlertTriangle,
  History,
  Paperclip,
  Image as ImageIcon,
  Video,
  FileText,
  Check,
  CheckCheck,
  Play,
  Pause,
  Bell,
  Calendar,
  Trash2
} from "lucide-react";
import * as React from "react";
import { useState, useEffect, useRef, useMemo } from "react";
import type { ReactNode } from "react";
import { db, auth, storage, handleFirestoreError } from "./firebase";
import { 
  collection, 
  onSnapshot, 
  query, 
  where,
  orderBy, 
  doc, 
  updateDoc, 
  addDoc, 
  setDoc,
  deleteDoc,
  writeBatch,
  getDocs,
  getDoc,
  serverTimestamp,
  limit
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { cn } from "./lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { 
  JAN_SYSTEM_INSTRUCTION, 
  JAN_RESPONSE_SCHEMA, 
  captureOrderTool, 
  checkInventoryTool, 
  updateCustomerProfileTool,
  generateAudio,
  generateImage
} from "./lib/janAgent";

// Type definitions
type Order = {
  id: string;
  customerName: string;
  customerPhone: string;
  address: string;
  addressIndicator?: string;
  city: string;
  productName: string;
  productId: string;
  quantity: number;
  totalPrice: number;
  status: 'pendiente' | 'despachado' | 'entregado';
  createdAt: any;
};

type Product = {
  id: string;
  docId?: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  currency: string;
  category: string;
  cost?: number;
  freight?: number;
  provider?: string;
  imageUrl?: string;
  videoUrl?: string;
};

type Activity = {
  id: string;
  from: string;
  to?: string;
  message: string;
  status: 'recibido' | 'procesando' | 'respondido' | 'error';
  whatsappStatus?: 'sent' | 'delivered' | 'read' | 'failed';
  manualAgent?: string;
  statusUpdateAt?: any;
  response?: string;
  timestamp: any;
  receivedAt?: any;
  processingAt?: any;
  respondedAt?: any;
  errorAt?: any;
  customerPhone?: string;
  recipient?: string;
  senderType?: string;
  botNumber?: string;
};

// Safe date formatter
const safeFormat = (ts: any, pattern: string) => {
  if (!ts) return "--:--:--";
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    if (!(d instanceof Date) || isNaN(d.getTime())) return "--:--:--";
    return format(d, pattern, { locale: es });
  } catch (e) {
    return "--:--:--";
  }
};

// Proper Error Boundary
class AppErrorBoundary extends (React.Component as any) {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: any, info: any) { console.error("Render Crash:", error, info); }
  render() {
    if ((this.state as any).hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-12 bg-neutral-900 rounded-3xl border border-red-900/20 text-center space-y-4">
          <AlertTriangle className="text-red-500 w-12 h-12" />
          <h2 className="text-xl font-bold text-white uppercase italic font-serif">¡Qué pena parce, se nos tostó la pantalla!</h2>
          <p className="text-neutral-500 text-sm max-w-sm">Hubo un error cargando esta sección. Intenta recargar la página o volver al dashboard.</p>
          <button onClick={() => window.location.reload()} className="bg-dark-accent text-black px-6 py-2 rounded-xl font-bold uppercase text-xs">Recargar Panel</button>
        </div>
      );
    }
    return (this.props as any).children;
  }
}

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Catalog from "./components/Catalog";

function JanAdmin() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [configStatus, setConfigStatus] = useState<{ type: 'idle' | 'success' | 'error', message: string }>({ type: 'idle', message: '' });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Record<string, any>>({});
  const [humanMessage, setHumanMessage] = useState("");
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [isClearing, setIsClearing] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'crm' | 'orders' | 'inventory' | 'reports' | 'config' | 'recovery' | 'monitor'>('dashboard');

  // Close sidebar on navigation on mobile
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [activeTab]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => setUser(u));
    const url = window.location.origin + "/api/webhook/whatsapp";
    setWebhookUrl(url);
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    const qOrders = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsubOrders = onSnapshot(qOrders, 
      (snapshot) => {
        const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Order));
        setOrders(docs);
      },
      (err) => console.error("[Firestore] Orders error:", err)
    );

    const qProducts = query(collection(db, "products"), orderBy("name", "asc"));
    const unsubProducts = onSnapshot(qProducts, 
      (snapshot) => {
        const docs = snapshot.docs.map(d => ({ docId: d.id, ...d.data() } as Product));
        setProducts(docs);
      },
      (err) => console.error("[Firestore] Products error:", err)
    );

    const qActivity = query(collection(db, "activities"), orderBy("timestamp", "desc"), limit(200));
    const unsubActivity = onSnapshot(qActivity, 
      (snapshot) => {
        const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Activity));
        setActivities(docs);
      },
      (err) => console.error("[Firestore] Activity error:", err)
    );
    
    // CRM
    const qCustomers = collection(db, "customers");
    const unsubCustomers = onSnapshot(qCustomers, 
      (snapshot) => {
        const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        // local sort to avoid need of index for now because we might vary order fields
        docs.sort((a: any, b: any) => (b.ultima_interaccion?.toMillis?.() || 0) - (a.ultima_interaccion?.toMillis?.() || 0));
        setCustomers(docs);
      },
      (err) => console.error("[Firestore] Customers error:", err)
    );

    const qConversations = collection(db, "conversations");
    const unsubConversations = onSnapshot(qConversations, (snapshot) => {
      const convs: Record<string, any> = {};
      snapshot.docs.forEach(d => {
        convs[d.id] = d.data();
      });
      setConversations(convs);
    });

    return () => {
      unsubOrders();
      unsubProducts();
      unsubActivity();
      unsubConversations();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsubStatus = onSnapshot(doc(db, "config", "system"), (snap) => {
      if (snap.exists()) {
        setSystemStatus(snap.data());
      }
    });
    return () => unsubStatus();
  }, [user]);

  const login = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err: any) {
      console.error("Login error:", err);
      if (err.code === "auth/popup-blocked") {
        setLoginError("El navegador bloqueó la ventana. Por favor permite los popups y refresca.");
      } else if (err.code === "auth/cancelled-popup-request") {
        setLoginError("Ya tienes una ventana de ingreso abierta.");
      } else if (err.code === "auth/internal-error" || err.message?.includes("Pending promise")) {
        setLoginError("Error interno. Recarga la página e intenta de nuevo.");
      } else if (err.code !== "auth/popup-closed-by-user") {
        setLoginError("No se pudo iniciar sesión. Intenta otra vez.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };
  const logout = () => signOut(auth);

  const clearTransactions = async () => {
    if (isClearing) return;
    if (!confirm("⚠️ ¡ADVERTENCIA CRÍTICA! Se borrarán todos los pedidos y actividades de prueba. Esta acción no se puede deshacer. ¿Deseas reiniciar el tablero para empezar ventas reales?")) return;
    
    setIsClearing(true);
    try {
      const res = await fetch("/api/admin/clear-transactions", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success("¡Viento en popa! El tablero ha sido reiniciado.");
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setIsClearing(false);
    }
  };

  const filteredOrders = useMemo(() => {
    if (!startDate && !endDate) return orders;
    return orders.filter(o => {
      const date = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
      if (startDate && date < new Date(startDate)) return false;
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (date > end) return false;
      }
      return true;
    });
  }, [orders, startDate, endDate]);

  const filteredActivities = useMemo(() => {
    if (!startDate && !endDate) return activities;
    return activities.filter(a => {
      const date = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
      if (startDate && date < new Date(startDate)) return false;
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (date > end) return false;
      }
      return true;
    });
  }, [activities, startDate, endDate]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const updateStock = async (docId: string, newStock: number) => {
    try {
      await updateDoc(doc(db, "products", docId), { stock: Math.max(0, newStock) });
    } catch (err) {
      console.error("Error updating stock:", err);
      handleFirestoreError(err, "update", `products/${docId}`);
    }
  };

  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    try {
      await updateDoc(doc(db, "orders", orderId), { status });
    } catch (err) {
      console.error("Error updating status:", err);
      handleFirestoreError(err, "update", `orders/${orderId}`);
    }
  };

  const resetDatabase = async () => {
    if (isResetting) return;
    if (!confirm("⚠️ ¿Estás seguro? Se borrará el catálogo actual y se cargará el estandar de la tienda desde el servidor.")) return;
    
    setIsResetting(true);
    try {
      const res = await fetch("/api/admin/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true })
      });
      const data = await res.json();
      if (data.success) {
        alert("¡Melo! Catálogo sincronizado con éxito desde el servidor.");
      } else {
        throw new Error(data.error || "Error en el servidor");
      }
    } catch (err: any) {
      console.error("Error resetting DB:", err);
      alert(`Hubo un problema: ${err.message || "Error desconocido"}`);
    } finally {
      setIsResetting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8 bg-neutral-900/50 p-10 rounded-3xl border border-neutral-800 backdrop-blur-xl shadow-2xl"
        >
          <div className="mx-auto w-20 h-20 bg-dark-accent/10 rounded-2xl flex items-center justify-center border border-dark-accent/20">
            <Cpu className="w-10 h-10 text-dark-accent" />
          </div>
          <div>
            <h1 className="text-3xl font-serif italic text-dark-accent">JANSEL SHOP</h1>
            <p className="text-neutral-500 text-sm mt-2">Acceso exclusivo al panel de control de ventas y pedidos.</p>
          </div>
          
          <div className="flex justify-center">
            <div className="flex items-center gap-2 bg-dark-green/10 text-dark-green text-[10px] font-black px-4 py-1.5 rounded-full border border-dark-green/20 animate-pulse">
              <Zap size={12} /> CEREBRO (API) ACTIVADO
            </div>
          </div>

          <button 
            onClick={login}
            disabled={isLoggingIn}
            className={cn(
              "w-full font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(242,125,38,0.2)]",
              isLoggingIn ? "bg-neutral-800 text-neutral-500 cursor-not-allowed" : "bg-dark-accent hover:bg-dark-accent/90 text-black"
            )}
          >
            {isLoggingIn ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <ExternalLink className="w-5 h-5" />
            )}
            {isLoggingIn ? "Conectando..." : "Ingresar con Google"}
          </button>

          {loginError && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-red-900/10 border border-red-900/20 p-4 rounded-xl flex items-start gap-3 text-left"
            >
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-red-400 font-bold uppercase tracking-tight">{loginError}</p>
            </motion.div>
          )}
          <p className="text-[10px] text-neutral-600 uppercase tracking-widest">Powered by Google AI Studio</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-neutral-300 font-sans flex flex-col lg:flex-row overflow-hidden relative">
      {user && <AIProcessor user={user} />}
      {/* Mobile Header */}
      <header className="lg:hidden h-14 bg-black border-b border-neutral-800 flex items-center justify-between px-4 sticky top-0 z-40 w-full shrink-0">
        <div className="flex items-center gap-2">
           <Cpu size={18} className="text-dark-accent" />
           <span className="font-serif italic text-lg text-dark-accent">JANSEL SHOP</span>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 text-neutral-400 hover:text-white"
        >
          {isSidebarOpen ? <Plus size={24} className="rotate-45" /> : <Settings size={20} />}
        </button>
      </header>

      {/* Sidebar Navigation */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-72 bg-black border-r border-neutral-800 flex flex-col h-screen shrink-0 z-50 transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 lg:w-64",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="p-8 hidden lg:block">
          <h1 className="font-serif italic text-2xl text-dark-accent tracking-tight leading-none">JANSEL SHOP</h1>
          <p className="text-[9px] text-neutral-500 uppercase tracking-[0.2em] mt-2 font-bold">Sales Architecture</p>
        </div>

        <nav className="flex-1 px-4 py-8 lg:py-0 space-y-2">
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<TrendingUp size={18} />} label="Dashboard" />
          <NavItem active={activeTab === 'crm'} onClick={() => setActiveTab('crm')} icon={<User size={18} />} label="CRM / Pipeline" />
          <NavItem active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} icon={<History size={18} />} label="Reportes" />
          <NavItem active={activeTab === 'monitor'} onClick={() => setActiveTab('monitor')} icon={<Clock size={18} />} label="Monitor" />
          <NavItem active={activeTab === 'recovery'} onClick={() => setActiveTab('recovery')} icon={<Zap size={18} />} label="Recuperación" />
          <NavItem active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} icon={<Truck size={18} />} label="Pedidos" count={orders.filter(o => o.status === 'pendiente').length} />
          <NavItem active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Box size={18} />} label="Inventario" />
          <NavItem active={activeTab === 'config'} onClick={() => setActiveTab('config')} icon={<Settings size={18} />} label="Configuración" />
        </nav>

        <div className="p-4 mt-auto">
          <div className="bg-neutral-900/50 rounded-2xl p-4 border border-neutral-800 space-y-3">
             <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-dark-accent/20 flex items-center justify-center border border-dark-accent/30 overflow-hidden shrink-0">
                  {user.photoURL ? <img src={user.photoURL} referrerPolicy="no-referrer" alt="avatar" /> : <User size={14} className="text-dark-accent" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-white truncate uppercase">{user.displayName || 'Parce'}</p>
                  <p className="text-[9px] text-neutral-500 truncate lowercase">Administrador</p>
                </div>
             </div>
             <button onClick={logout} className="w-full text-left text-neutral-500 hover:text-red-400 text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 transition-colors pl-1">
               <LogOut size={12} /> Salir
             </button>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 h-screen overflow-y-auto bg-black flex flex-col relative">
        <header className="h-16 border-b border-neutral-800 flex items-center justify-between px-4 lg:px-8 bg-black/50 backdrop-blur-md sticky top-0 z-30 w-full shrink-0">
          <div className="flex items-center gap-4">
             <div className="hidden md:flex items-center gap-2 bg-neutral-900 border border-neutral-800 p-1 rounded-xl">
                <div className="flex items-center gap-2 px-3 py-1">
                  <Calendar size={12} className="text-dark-accent" />
                  <span className="text-[9px] font-black uppercase text-neutral-500">Desde:</span>
                </div>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-black text-[9px] text-white border-none outline-none p-1.5 rounded hover:bg-neutral-800 transition-colors cursor-pointer"
                />
                <span className="text-neutral-700 mx-1">|</span>
                <div className="flex items-center gap-2 px-3 py-1">
                  <span className="text-[9px] font-black uppercase text-neutral-500">Hasta:</span>
                </div>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-black text-[9px] text-white border-none outline-none p-1.5 rounded hover:bg-neutral-800 transition-colors cursor-pointer"
                />
                {(startDate || endDate) && (
                  <button 
                    onClick={() => { setStartDate(""); setEndDate(""); }}
                    className="p-1 px-2 text-red-500 hover:text-red-400 transition-colors"
                    title="Limpiar filtros"
                  >
                    <Plus size={16} className="rotate-45" />
                  </button>
                )}
             </div>
             <div className="w-[1px] h-6 bg-neutral-800 hidden md:block mx-2" />
             <h2 className="text-[9px] lg:text-xs font-black uppercase tracking-[0.2em] lg:tracking-[0.3em] text-neutral-400">
               {activeTab === 'dashboard' && 'Visión General del Negocio'}
               {activeTab === 'crm' && 'CRM Pipeline de Clientes'}
               {activeTab === 'reports' && 'Reporte de Conversaciones'}
               {activeTab === 'monitor' && 'Monitor de Tiempo Real (Audit)'}
               {activeTab === 'recovery' && 'Activación de Ventas Abandonadas'}
               {activeTab === 'orders' && 'Ventana de Pedidos WhatsApp'}
               {activeTab === 'inventory' && 'Control de Stock Inteligente'}
               {activeTab === 'config' && 'Ajustes del Sistema'}
             </h2>
          </div>
          <div className="flex items-center gap-4">
             <button 
               onClick={async () => {
                 try {
                   const res = await fetch("/api/admin/test-notify", { method: "POST" });
                   if (res.ok) alert("✅ Mensaje de prueba enviado. Revisa tu WhatsApp parce.");
                   else alert("❌ Error. Asegúrate de haber puesto los números en los Secrets.");
                 } catch (e) {
                   alert("Error de conexión.");
                 }
               }}
               className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 hover:border-dark-accent text-[9px] font-black uppercase text-neutral-400 hover:text-white px-4 py-2 rounded-xl transition-all"
             >
               <Bell size={12} />
               Notificar Prueba
             </button>
             <div className="flex items-center gap-2 bg-dark-green/10 text-dark-green text-[9px] font-bold px-2 lg:px-3 py-1 rounded-full border border-dark-green/20 animate-pulse">
               <Zap size={10} /> <span className="hidden sm:inline">BOT ACTIVO</span>
             </div>
          </div>
        </header>

        {systemStatus?.twilioLimitReached && (
          <div className="bg-red-500 text-black px-4 py-3 flex items-center justify-between shadow-2xl relative z-40 border-b border-red-600">
            <div className="flex items-center gap-3">
              <AlertTriangle className="animate-bounce" size={18} />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest leading-none">⚠️ SISTEMA SUSPENDIDO: Límite de WhatsApp alcanzado</p>
                <p className="text-[9px] font-bold opacity-80 mt-1 uppercase">Twilio Trial restringe a 50 mensajes diarios. Se reseteará mañana automáticamente.</p>
              </div>
            </div>
            <button 
              onClick={() => updateDoc(doc(db, "config", "system"), { twilioLimitReached: false })}
              className="bg-black/20 hover:bg-black/40 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-colors"
            >
              Cerrar Aviso
            </button>
          </div>
        )}

        <div className="p-4 lg:p-8 max-w-7xl mx-auto w-full">
           <AppErrorBoundary>
              <AnimatePresence mode="wait" initial={false}>
                 {activeTab === 'dashboard' && <Dashboard key="dash" orders={filteredOrders} products={products} activities={filteredActivities} onShowReports={() => setActiveTab('reports')} onShowRecovery={() => setActiveTab('recovery')} />}
                 {activeTab === 'crm' && <CRMTab key="crm" customers={customers} selectedUser={selectedUser} onSelectUser={(phone: string) => { setSelectedUser(phone); setActiveTab('monitor'); }} />}
                 {activeTab === 'reports' && <ReportsTab key="reports"
                    activities={filteredActivities} 
                    conversations={conversations}
                    selectedUser={selectedUser}
                    setSelectedUser={setSelectedUser}
                    humanMessage={humanMessage}
                    setHumanMessage={setHumanMessage}
                    systemStatus={systemStatus}
                  />}
                  {activeTab === 'monitor' && <MonitorTab key="monitor" activities={filteredActivities} />}
                 {activeTab === 'recovery' && <RecoveryTab 
                    key="recovery" 
                    activities={filteredActivities} 
                    onSelectUser={(phone: string) => {
                      setSelectedUser(phone);
                      setActiveTab('reports');
                    }}
                  />}
                 {activeTab === 'orders' && <OrdersTab key="orders" orders={filteredOrders} onUpdateStatus={updateOrderStatus} />}
                 {activeTab === 'inventory' && <InventoryTab key="inv" products={products} onUpdateStock={updateStock} onReset={resetDatabase} isResetting={isResetting} />}
                 {activeTab === 'config' && (
                   <ConfigTab 
                     key="config"
                     webhookUrl={webhookUrl} 
                     copied={copied} 
                     onCopy={copyToClipboard} 
                     onClearTransactions={clearTransactions}
                     isClearing={isClearing}
                     apiKeyInput={apiKeyInput}
                     setApiKeyInput={setApiKeyInput}
                     configStatus={configStatus}
                     onReset={resetDatabase}
                     isResetting={isResetting}
                     onUpdateApiKey={async () => {
                       if (!apiKeyInput) return;
                       try {
                         const res = await fetch("/api/admin/config", {
                           method: "POST",
                           headers: { "Content-Type": "application/json" },
                           body: JSON.stringify({ apiKey: apiKeyInput })
                         });
                         const data = await res.json();
                         if (data.success) {
                           setConfigStatus({ type: 'success', message: "Cerebro actualizado." });
                           setApiKeyInput("");
                         }
                       } catch {
                         setConfigStatus({ type: 'error', message: "Error de red." });
                       }
                     }}
                   />
                 )}
              </AnimatePresence>
           </AppErrorBoundary>
        </div>
      </main>
    </div>
  );
}

/**
 * BACKGROUND AI AGENT
 * This component runs while the dashboard is open.
 * It listens for new WhatsApp messages and processes them via Gemini.
 */
function AIProcessor({ user }: { user: FirebaseUser }) {
  const [processingCount, setProcessingCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    console.log("[AI Agent] Monitoring processing status...");
    const q = query(
      collection(db, "activities"), 
      where("status", "==", "procesando"),
      limit(20)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
       setProcessingCount(snapshot.docs.length);
    });

    return () => unsubscribe();
  }, [user]);

  if (processingCount === 0) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[100] pointer-events-none">
      <div className="bg-neutral-900 border border-dark-accent/20 rounded-2xl p-4 shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-dark-accent/10 flex items-center justify-center border border-dark-accent/20">
            <Cpu className="w-5 h-5 text-dark-accent animate-pulse" />
          </div>
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-dark-accent rounded-full flex items-center justify-center border-2 border-neutral-900">
            <span className="text-[8px] font-black text-black">{processingCount}</span>
          </div>
        </div>
        <div>
          <h4 className="text-white text-[10px] font-black uppercase tracking-widest">Jan Procesando...</h4>
          <p className="text-[9px] text-neutral-500">Auto-respuesta activa en el servidor.</p>
        </div>
      </div>
    </div>
  );
}

function NavItem({ active, onClick, icon, label, count }: { active: boolean, onClick: () => void, icon: ReactNode, label: string, count?: number }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 group relative",
        active ? "bg-dark-accent text-black font-bold shadow-[0_4px_15px_rgba(242,125,38,0.3)]" : "hover:bg-neutral-800/50 text-neutral-500"
      )}
    >
      <div className="flex items-center gap-3">
        <span className={cn("transition-transform group-hover:scale-110", active ? "text-black" : "text-neutral-400")}>{icon}</span>
        <span className="text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      {count !== undefined && count > 0 && (
        <span className={cn(
          "text-[9px] px-1.5 py-0.5 rounded-md font-black transition-colors duration-200",
          active ? "bg-black/20 text-black" : "bg-dark-accent text-black"
        )}>
          {count}
        </span>
      )}
      {active && <motion.div layoutId="nav-glow" className="absolute inset-0 bg-white/10 rounded-xl pointer-events-none" />}
    </button>
  );
}

function Dashboard({ orders, products, activities, onShowReports, onShowRecovery }: { orders: Order[], products: Product[], activities: Activity[], onShowReports: () => void, onShowRecovery: () => void, key?: string }) {
  // Financial Calculations
  const totalRevenue = orders.reduce((acc, curr) => acc + (curr.totalPrice || 0), 0);
  
  const financialStats = orders.reduce((acc, order) => {
    const product = products.find(p => p.id === order.productId);
    const cost = (product?.cost || 0) * (order.quantity || 1);
    const freight = (product?.freight || 15000) * (order.quantity || 1);
    const profit = order.totalPrice - cost - freight;
    
    acc.totalCost += cost;
    acc.totalFreight += freight;
    acc.totalProfit += profit;
    return acc;
  }, { totalCost: 0, totalFreight: 0, totalProfit: 0 });

  const inventoryValue = products.reduce((acc, p) => acc + (p.cost || 0) * p.stock, 0);

  const stats = [
    { label: "Ventas Totales", value: orders.length, icon: <TrendingUp size={16} />, color: "text-blue-400" },
    { label: "Ingresos Brutos", value: `$${totalRevenue.toLocaleString()}`, icon: <DollarSign size={16} />, color: "text-white" },
    { label: "Ganancia Neta", value: `$${financialStats.totalProfit.toLocaleString()}`, icon: <Zap size={16} />, color: "text-dark-green" },
    { label: "Inversión Pend.", value: `$${inventoryValue.toLocaleString()}`, icon: <Box size={16} />, color: "text-dark-accent" }
  ];

  const financialMix = [
    { name: 'Costos Proveedor', value: financialStats.totalCost, color: '#333' },
    { name: 'Fletes/Envío', value: financialStats.totalFreight, color: '#444' },
    { name: 'Ganancia Real', value: financialStats.totalProfit, color: '#F27D26' }
  ];

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return format(d, 'MMM d', { locale: es });
  }).reverse();

  const chartData = last7Days.map(day => {
    const count = orders.filter(o => {
      if (!o.createdAt) return false;
      try {
        const createdAtDate = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
        if (!(createdAtDate instanceof Date) || isNaN(createdAtDate.getTime())) return false;
        return format(createdAtDate, 'MMM d', { locale: es }) === day;
      } catch (e) {
        return false;
      }
    }).length;
    return { name: day, ventas: count };
  });

  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
      <div className="flex items-center justify-between mb-[-16px]">
         <div className="flex items-center gap-3">
            <div className="bg-dark-accent/10 border border-dark-accent/20 px-3 py-1.5 rounded-xl flex items-center gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-dark-green animate-pulse" />
               <span className="text-[9px] font-black uppercase text-dark-accent tracking-tighter">Instancia SaaS: Jan Vanegas HQ</span>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded-xl text-[9px] font-bold text-neutral-500 uppercase tracking-widest">
               WhatsApp API: Conectado
            </div>
         </div>
         <div className="text-[9px] text-neutral-600 font-mono uppercase tracking-widest">Jan v3.1.2 SaaS Engine</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((s, i) => (
          <div key={i} className="bg-[#111] border border-neutral-800 p-6 rounded-2xl flex items-center justify-between ring-1 ring-white/5 transition-all hover:border-neutral-700">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold">{s.label}</p>
              <h4 className={cn("text-2xl font-serif italic", s.color)}>{s.value}</h4>
            </div>
            <div className={cn("p-3 rounded-xl bg-black/50 border border-neutral-800", s.color)}>{s.icon}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-[#111] border border-neutral-800 p-8 rounded-2xl ring-1 ring-white/5">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-dark-accent text-xs font-bold uppercase tracking-widest">Tendencia de Ventas (7 días)</h3>
              <span className="text-[10px] text-neutral-500">Actualizado en tiempo real</span>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#222" />
                  <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#666' }} />
                  <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#666' }} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '12px', fontSize: '10px' }}
                  />
                  <Bar dataKey="ventas" fill="#F27D26" radius={[4, 4, 0, 0]} barSize={40}>
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="bg-[#111] border border-neutral-800 p-8 rounded-2xl ring-1 ring-white/5">
                <h3 className="text-dark-accent text-xs font-bold uppercase tracking-widest mb-6">Desglose Financiero</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-black/40 rounded-xl border border-white/5">
                    <span className="text-[10px] uppercase text-neutral-500 font-bold">Total Costos Prov.</span>
                    <span className="font-mono text-sm text-neutral-300">${financialStats.totalCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-black/40 rounded-xl border border-white/5">
                    <span className="text-[10px] uppercase text-neutral-500 font-bold">Total Fletes</span>
                    <span className="font-mono text-sm text-neutral-300">${financialStats.totalFreight.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-dark-green/5 rounded-xl border border-dark-green/20">
                    <span className="text-[10px] uppercase text-dark-green font-black">Ganancia Real</span>
                    <span className="font-mono text-sm text-dark-green font-black">${financialStats.totalProfit.toLocaleString()}</span>
                  </div>
                </div>
             </div>
             <div className="bg-[#111] border border-neutral-800 p-8 rounded-2xl ring-1 ring-white/5 flex flex-col items-center justify-center">
                <div className="text-center space-y-1 mb-4">
                   <p className="text-[10px] uppercase text-neutral-500 font-bold">Eficiencia del Negocio</p>
                   <p className="text-2xl font-serif italic text-white">{((financialStats.totalProfit / (totalRevenue || 1)) * 100).toFixed(1)}%</p>
                   <p className="text-[8px] text-white/40 uppercase font-black">Margen Promedio</p>
                </div>
                <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden border border-white/5 mt-auto">
                   <div 
                    className="h-full bg-dark-accent transition-all duration-1000" 
                    style={{ width: `${(financialStats.totalProfit / (totalRevenue || 1)) * 100}%` }}
                   />
                </div>
             </div>

             <div className="bg-gradient-to-br from-[#1a1a1a] to-[#111] border border-dark-accent/30 p-8 rounded-2xl ring-1 ring-white/5 relative overflow-hidden group flex flex-col justify-between">
                <div className="absolute -top-4 -right-4 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                   <Zap size={100} className="text-dark-accent" />
                </div>
                <div className="relative z-10 space-y-2">
                   <div className="w-8 h-8 rounded-lg bg-dark-accent/20 flex items-center justify-center mb-4">
                      <History size={16} className="text-dark-accent" />
                   </div>
                   <h4 className="text-white font-serif italic text-xl leading-tight">Activación de Ventas</h4>
                   <p className="text-[9px] text-neutral-500 uppercase font-black tracking-widest leading-relaxed">Jan detectó 4 clientes en 'visto'. ¿Lanzar ráfaga de recuperación?</p>
                </div>
                <button 
                  onClick={onShowRecovery}
                  className="relative z-10 w-full mt-6 bg-dark-accent text-black py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white transition-colors duration-300 shadow-lg shadow-dark-accent/10"
                >
                   Lanzar Jan Recuperador
                </button>
             </div>
          </div>
        </div>

        <div className="bg-[#111] border border-neutral-800 p-8 rounded-2xl flex flex-col ring-1 ring-white/5">
          <h3 className="text-dark-accent text-xs font-bold uppercase tracking-widest mb-6">Monitor de WhatsApp (Vivo)</h3>
          <div className="space-y-4 flex-1">
             {activities.slice(0, 5).map((a) => (
               <div key={a.id} className="border-l-2 border-neutral-800 pl-4 py-1 space-y-1 group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-neutral-500 font-mono">
                        {safeFormat(a.timestamp, 'HH:mm:ss')}
                      </span>
                      <span className="text-[8px] text-dark-accent font-black uppercase tracking-tighter bg-dark-accent/10 px-1 rounded">
                        {(a.from || "unknown").slice(-4)}
                      </span>
                    </div>
                    <span className={cn(
                      "text-[8px] uppercase font-black px-1.5 py-0.5 rounded-sm",
                      a.status === 'recibido' && 'bg-blue-900/40 text-blue-400',
                      a.status === 'procesando' && 'bg-yellow-900/40 text-yellow-500 animate-pulse',
                      a.status === 'respondido' && 'bg-dark-green/40 text-dark-green',
                      a.status === 'error' && 'bg-red-900/40 text-red-500'
                    )}>
                      {a.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-white font-medium truncate italic">"{a.message}"</p>
                  {a.response && (
                    <div className="flex items-start gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <ChevronRight size={10} className="mt-0.5" />
                      <p className="text-[9px] text-neutral-500 line-clamp-1">{a.response}</p>
                    </div>
                  )}
               </div>
             ))}
             {activities.length === 0 && <p className="text-[10px] text-neutral-600 italic">Sin actividad reciente.</p>}
          </div>
          <button 
            onClick={onShowReports}
            className="w-full py-3 bg-neutral-900 border border-neutral-800 rounded-xl text-[10px] uppercase font-bold tracking-widest hover:bg-neutral-800 transition-colors mt-6"
          >
            Historial de Mensajes
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function ReportsTab({ 
  activities, 
  conversations,
  selectedUser, 
  setSelectedUser, 
  humanMessage, 
  setHumanMessage,
  systemStatus
}: { 
  activities: Activity[], 
  conversations: Record<string, any>,
  selectedUser: string | null, 
  setSelectedUser: (id: string | null) => void,
  humanMessage: string,
  setHumanMessage: (msg: string) => void,
  systemStatus: any,
  key?: string
}) {
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isIntervening, setIsIntervening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedConversation = useMemo(() => {
    if (!selectedUser) return null;
    const cleanPhone = selectedUser.replace("whatsapp:", "").replace("+", "").trim();
    // Try both with and without plus for fallback
    return conversations[cleanPhone] || conversations[`+${cleanPhone}`] || { aiPaused: false };
  }, [conversations, selectedUser]);

  const handleIntervention = async (agentName: string) => {
    if (!selectedUser || isIntervening) return;
    setIsIntervening(true);
    try {
      const res = await fetch("/api/whatsapp/intervene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: selectedUser, agentName })
      });
      if (!res.ok) {
        const errorData = await res.json();
        alert(`Error al intervenir: ${errorData.error || "Desconocido"}`);
      }
    } catch (e: any) {
      console.error(e);
      alert(`Error de red al intervenir: ${e.message}`);
    } finally {
      setIsIntervening(false);
    }
  };

  const handleToggleAI = async (pause: boolean) => {
    if (!selectedUser) return;
    console.log("[Toggle AI] Requesting:", { phone: selectedUser, pause });
    try {
      const res = await fetch("/api/whatsapp/toggle-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: selectedUser, pause })
      });
      if (!res.ok) {
        const errorData = await res.json();
        alert(`Error al cambiar estado de IA: ${errorData.error || "Desconocido"}`);
      }
    } catch (e: any) {
      console.error(e);
      alert(`Error de red al cambiar estado: ${e.message}`);
    }
  };

  // Group activities by user (phone number)
  const userConversations = useMemo(() => {
    return activities.reduce((acc, curr) => {
      // Logic: The userId is the phone of the CUSTOMER.
      // If messages are from the customer, userId is curr.from
      // If messages are from the bot/admin, userId is in curr.to or curr.customerPhone
      let userId = 'unknown';
      const from = curr.from || "";
      const to = curr.to || "";
      const customerPhone = curr.customerPhone || "";
      const senderType = curr.senderType || "";

      // Improved bot detection: trust senderType or status
      const isBot = senderType === 'bot' || curr.status === "respondido" || !!curr.manualAgent || from.includes('14155238886');

      if (isBot) {
        userId = (customerPhone || to).replace('whatsapp:', '');
      } else {
        userId = (curr.recipient || from).replace('whatsapp:', '');
      }
      
      if (userId === "unknown" || !userId) return acc;
      
      // Filter out bot's own numbers from appearing as customers
      const botNumbers = ['14155238886', '15072233213'];
      if (botNumbers.some(n => userId.includes(n))) return acc;

      if (!acc[userId]) {
        acc[userId] = {
          lastMessage: curr.message,
          timestamp: curr.timestamp,
          messages: []
        };
      }
      acc[userId].messages.push(curr);
      // Sort messages within conversation
      acc[userId].messages.sort((a, b) => {
        const timeA = (a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime())) || 0;
        const timeB = (b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime())) || 0;
        return timeA - timeB;
      });
      // Update last message
      const lastMsg = acc[userId].messages[acc[userId].messages.length - 1];
      acc[userId].lastMessage = lastMsg.message || lastMsg.response || "";
      acc[userId].timestamp = lastMsg.timestamp;
      
      return acc;
    }, {} as Record<string, { lastMessage: string, timestamp: any, messages: Activity[] }>);
  }, [activities]);

  const userIds = useMemo(() => {
    return Object.keys(userConversations).sort((a, b) => {
      const timeA = (userConversations[a].timestamp?.toMillis ? userConversations[a].timestamp.toMillis() : (userConversations[a].timestamp instanceof Date ? userConversations[a].timestamp.getTime() : new Date(userConversations[a].timestamp).getTime())) || 0;
      const timeB = (userConversations[b].timestamp?.toMillis ? userConversations[b].timestamp.toMillis() : (userConversations[b].timestamp instanceof Date ? userConversations[b].timestamp.getTime() : new Date(userConversations[b].timestamp).getTime())) || 0;
      return timeB - timeA;
    });
  }, [userConversations]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedUser) return;

    setIsUploading(true);
    try {
      const response = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: await file.arrayBuffer()
      });
      const data = await response.json();
      if (data.success) {
        // Automatically send the media message
        await sendManualMessage("", data.url);
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("Error al subir archivo.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const sendManualMessage = async (msg?: string, mediaUrl?: string) => {
    const messageToSend = msg !== undefined ? msg : humanMessage;
    if (!selectedUser || (!messageToSend.trim() && !mediaUrl) || isSending) return;

    if (systemStatus?.twilioLimitReached) {
      alert("⚠️ LÍMITE DE CUENTA: No puedes enviar más mensajes hoy debido al límite de Twilio Trial (50/día). Se reseteará automáticamente mañana.");
      return;
    }

    setIsSending(true);
    try {
      // Auto-pause AI if human intervenes
      if (!selectedConversation?.aiPaused) {
        handleToggleAI(true);
      }
      
      const res = await fetch("/api/admin/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: selectedUser, message: messageToSend, mediaUrl })
      });
      
      if (res.ok) {
        if (msg === undefined) setHumanMessage("");
      } else {
        const data = await res.json();
        if (res.status === 429 || data.limitReached) {
          alert("⚠️ LÍMITE ALCANZADO: Tu cuenta de Twilio Trial ha superado los 50 mensajes diarios. Jan no puede enviar más mensajes por hoy. Por favor, espera 24h o actualiza tu cuenta de Twilio.");
        } else {
          alert(`Error: ${data.error || "No se pudo enviar el mensaje."}`);
        }
      }
    } catch (e) {
      console.error("Manual send error:", e);
    } finally {
      setIsSending(false);
    }
  };

  const [showStatusId, setShowStatusId] = useState<string | null>(null);

  const renderMedia = (text: string) => {
    const mediaMatch = text.match(/\[Media:\s*(https?:\/\/[^\]]+)\]/);
    if (!mediaMatch) return null;
    const url = mediaMatch[1];
    
    // Improved detection: Check for media type based on extension
    const isVideo = url.match(/\.(mp4|webm|ogg)/i);
    const isAudio = url.match(/\.(mp3|wav|m4a|aac)/i) || (url.includes('/api/media/') && url.endsWith('.mp3'));
    const isImage = url.match(/\.(jpg|jpeg|png|gif|webp)/i);
    
    if (isVideo) {
      return <video src={url} controls className="mt-2 rounded-lg max-w-full border border-white/10" />;
    }
    if (isAudio) {
      return <audio src={url} controls className="mt-2 w-full" />;
    }
    if (isImage) {
      return <img src={url} alt="Media" className="mt-2 rounded-lg max-w-full h-auto" />;
    }
    return null;
  };
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="h-[calc(100vh-140px)] lg:h-[calc(100vh-180px)] bg-[#111] border border-neutral-800 rounded-3xl overflow-hidden flex flex-col md:flex-row ring-1 ring-white/5 shadow-2xl relative">
      {/* Sidebar: User List */}
      <div className={cn(
        "w-full md:w-80 border-r border-neutral-800 flex flex-col bg-[#0d0d0d] absolute inset-0 md:relative z-10 transition-transform duration-300 md:translate-x-0",
        selectedUser ? "-translate-x-full md:translate-x-0" : "translate-x-0"
      )}>
        <div className="p-6 border-b border-neutral-800">
          <h3 className="text-dark-accent text-[10px] font-black uppercase tracking-[0.2em]">Clientes Activos</h3>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {userIds.map(uid => (
            <button
              key={uid}
              onClick={() => setSelectedUser(uid)}
              className={cn(
                "w-full p-4 flex items-center gap-4 transition-all border-b border-neutral-900/50 group text-left",
                selectedUser === uid ? "bg-dark-accent/10 border-l-4 border-l-dark-accent" : "hover:bg-white/5"
              )}
            >
              <div className="w-12 h-12 rounded-2xl bg-neutral-900 flex items-center justify-center border border-neutral-800 shrink-0 group-hover:border-dark-accent/30 transition-colors">
                <User size={20} className={cn(selectedUser === uid ? "text-dark-accent" : "text-neutral-600")} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <p className={cn("text-xs font-black truncate uppercase", selectedUser === uid ? "text-dark-accent" : "text-white")}>
                    {uid}
                  </p>
                  <span className="text-[8px] text-neutral-600 font-mono">
                    {safeFormat(userConversations[uid].timestamp, 'HH:mm')}
                  </span>
                </div>
                <p className="text-[10px] text-neutral-500 truncate italic">
                  "{userConversations[uid].lastMessage}"
                </p>
              </div>
            </button>
          ))}
          {userIds.length === 0 && (
            <div className="p-12 text-center opacity-30">
              <MessageSquare size={32} className="mx-auto mb-2" />
              <p className="text-[10px] uppercase font-bold tracking-widest">Sin chats</p>
            </div>
          )}
        </div>
      </div>

      {/* Main: Chat View */}
      <div className={cn(
        "flex-1 flex flex-col bg-black/40 relative h-full transition-transform duration-300 md:translate-x-0",
        selectedUser ? "translate-x-0" : "translate-x-full md:translate-x-0"
      )}>
        {selectedUser ? (
          <>
            {/* Chat Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-black/20 backdrop-blur-sm gap-4">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setSelectedUser(null)}
                      className="p-2 md:hidden text-neutral-500 hover:text-white"
                    >
                      <ChevronRight size={20} className="rotate-180" />
                    </button>
                    <div className="w-10 h-10 rounded-xl bg-dark-accent/10 flex items-center justify-center border border-dark-accent/20">
                      <Phone size={16} className="text-dark-accent" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white">
                          {selectedUser.startsWith('+') ? selectedUser : `+${selectedUser}`}
                        </h4>
                        {selectedConversation?.aiPaused && (
                          <span className="bg-red-500/10 text-red-500 text-[7px] font-black px-1.5 py-0.5 rounded border border-red-500/20 uppercase tracking-widest animate-pulse">
                            IA Pausada
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] text-dark-green uppercase font-bold tracking-widest flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-dark-green rounded-full animate-pulse" /> <span className="hidden xs:inline">WhatsApp</span> Activo
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => handleToggleAI(!selectedConversation?.aiPaused)}
                      className={cn(
                        "text-[9px] font-black px-6 py-3 rounded-xl border transition-all active:scale-95 flex items-center gap-3 shadow-lg uppercase tracking-wider",
                        selectedConversation?.aiPaused 
                          ? "bg-dark-green text-black border-dark-green hover:bg-dark-green/90 shadow-dark-green/40 shadow-lg" 
                          : "bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500 hover:text-black shadow-red-500/10"
                      )}
                    >
                      {selectedConversation?.aiPaused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
                      {selectedConversation?.aiPaused ? "REANUDAR IA (BOT ACTIVO)" : "PAUSAR IA (INTERVENCIÓN MANUAL)"}
                    </button>
                  </div>
                </div>

                <div className="px-4 py-2 border-b border-neutral-800 bg-black/40 flex items-center gap-4 overflow-x-auto no-scrollbar">
                  <span className="text-[7px] font-black text-neutral-500 uppercase tracking-widest shrink-0">Atajos Rápidos:</span>
                  <button onClick={() => sendManualMessage("¡Patrón! Si paga ya por transferencia se libera de los $25.000 de seguro que cobra la transportadora por el contra-entrega. ¡No pierda esa plata y sea cliente VIP con despacho hoy mismo!")} className="whitespace-nowrap text-[7px] font-black uppercase tracking-tighter bg-neutral-900 border border-neutral-800 px-3 py-1 rounded-md hover:border-dark-accent transition-all flex items-center gap-1.5 grow-0 shrink-0"><DollarSign size={8} className="text-green-500" /> Beneficio</button>
                  <button onClick={() => sendManualMessage("¡Rey! Se me acabaron de llevar el penúltimo. Solo me queda UNO con su nombre. ¿Se lo separo ya mismo o se lo paso al siguiente?")} className="whitespace-nowrap text-[7px] font-black uppercase tracking-tighter bg-neutral-900 border border-neutral-800 px-3 py-1 rounded-md hover:border-dark-accent transition-all flex items-center gap-1.5 grow-0 shrink-0"><AlertTriangle size={8} className="text-orange-500" /> Cierre</button>
                  <button onClick={() => sendManualMessage("¡Buenas! El repartidor ya está cargando el camión VIP. Si transfiere ahorita, su pedido sale de primero. ¿Hacemos el negocio ya para que le llegue mañana?")} className="whitespace-nowrap text-[7px] font-black uppercase tracking-tighter bg-neutral-900 border border-neutral-800 px-3 py-1 rounded-md hover:border-dark-accent transition-all flex items-center gap-1.5 grow-0 shrink-0"><Truck size={8} className="text-blue-500" /> Prioridad</button>
                </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 lg:p-8 flex flex-col-reverse gap-6 custom-scrollbar">
              {selectedUser && userConversations[selectedUser] && [...userConversations[selectedUser].messages].sort((a,b) => (b.timestamp?.toMillis ? b.timestamp.toMillis() : 0) - (a.timestamp?.toMillis ? a.timestamp.toMillis() : 0)).map((msg) => (
                <div key={msg.id} className="space-y-4">
                  {/* Incoming: User */}
                  <div className="flex items-start gap-4 max-w-[85%]">
                    <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0">
                      <User size={14} className="text-neutral-600" />
                    </div>
                    <div>
                      <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-2xl rounded-tl-none text-white text-[13px] leading-relaxed shadow-lg">
                        {msg.message.split(" [Media:")[0]}
                        {renderMedia(msg.message)}
                      </div>
                      <p className="text-[9px] text-neutral-600 mt-2 font-mono uppercase">
                        {safeFormat(msg.timestamp, 'HH:mm:ss')}
                      </p>
                    </div>
                  </div>

                  {/* Outgoing: Jan (IA) or Asesor */}
                  {msg.response && (
                    <div className="flex items-start gap-4 max-w-[85%] ml-auto flex-row-reverse">
                      <div className={cn(
                        "w-8 h-8 rounded-lg border flex items-center justify-center shrink-0",
                        msg.message === "[Asesor Humano]" ? "bg-dark-accent/20 border-dark-accent/30" : "bg-dark-green/10 border-dark-green/20"
                      )}>
                        {msg.message === "[Asesor Humano]" ? <User size={14} className="text-dark-accent" /> : <Cpu size={14} className="text-dark-green" />}
                      </div>
                      <div className="text-right">
                        <div 
                          className={cn(
                            "p-4 rounded-2xl rounded-tr-none text-[13px] leading-relaxed shadow-xl border cursor-pointer select-none",
                            msg.message === "[Asesor Humano]" 
                              ? "bg-dark-accent text-white border-dark-accent" 
                              : "bg-neutral-800 text-neutral-200 border-neutral-700 font-medium italic"
                          )}
                          onClick={() => setShowStatusId(showStatusId === msg.id ? null : msg.id)}
                        >
                          <div className="flex items-center justify-between mb-1 opacity-50 text-[8px] font-black uppercase tracking-widest">
                            <span>{msg.manualAgent || "Jan AI"}</span>
                            {msg.manualAgent && <span className="flex items-center gap-1"><User size={8}/> Manual</span>}
                          </div>
                          {msg.response.split(" [Media:")[0]}
                          {renderMedia(msg.response)}
                        </div>
                        <div className="flex flex-col items-end gap-1 mt-2">
                           {showStatusId === msg.id && (
                             <motion.div 
                               initial={{ opacity: 0, height: 0 }} 
                               animate={{ opacity: 1, height: 'auto' }}
                               className="bg-black/40 border border-white/5 px-2 py-1 rounded text-[8px] uppercase font-bold tracking-widest text-neutral-400 mb-1"
                             >
                                <div className="flex items-center gap-2">
                                  <span>Estado:</span>
                                  <span className={cn(
                                    msg.whatsappStatus === 'read' ? 'text-blue-400' : 
                                    msg.whatsappStatus === 'delivered' ? 'text-white' : 'text-neutral-500'
                                  )}>
                                    {msg.whatsappStatus === 'read' ? 'Visto' : 
                                     msg.whatsappStatus === 'delivered' ? 'Entregado' : 
                                     msg.whatsappStatus === 'sent' ? 'Enviado' : 'Pendiente'}
                                  </span>
                                </div>
                                {msg.statusUpdateAt && (
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span>Recibido:</span>
                                    <span className="text-white">{safeFormat(msg.statusUpdateAt, 'dd MMM, HH:mm:ss')}</span>
                                  </div>
                                )}
                             </motion.div>
                           )}
                           <div className="flex items-center justify-end gap-2">
                              <div className="flex items-center gap-1 bg-black/20 px-2 py-0.5 rounded-full border border-white/5">
                                 {msg.whatsappStatus === 'read' ? (
                                   <>
                                     <span className="text-[7px] font-black text-blue-400 uppercase tracking-tighter">Visto</span>
                                     <CheckCheck size={10} className="text-blue-500" />
                                   </>
                                 ) : msg.whatsappStatus === 'delivered' ? (
                                   <>
                                     <span className="text-[7px] font-black text-neutral-400 uppercase tracking-tighter">Entregado</span>
                                     <CheckCheck size={10} className="text-neutral-500" />
                                   </>
                                 ) : msg.whatsappStatus === 'failed' ? (
                                   <>
                                     <span className="text-[7px] font-black text-red-500 uppercase tracking-tighter">Falló</span>
                                     <AlertTriangle size={10} className="text-red-500" />
                                   </>
                                 ) : (
                                   <>
                                     <span className="text-[7px] font-black text-neutral-500 uppercase tracking-tighter">Enviado</span>
                                     <Check size={10} className="text-neutral-500" />
                                   </>
                                 )}
                              </div>
                              <p className="text-[9px] text-neutral-600 font-mono uppercase">
                                {msg.message === "[Asesor Humano]" ? "Intervención Manual" : "Jan AI Response"}
                              </p>
                           </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Input Area */}
            <div className="p-6 border-t border-neutral-800 bg-black/40 backdrop-blur-md">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
                accept="image/*,video/*,audio/*"
              />
              <div className="flex items-center gap-4 bg-neutral-900/50 p-2 pl-4 rounded-2xl border border-neutral-800 focus-within:border-dark-accent transition-all ring-1 ring-white/5">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="p-2 text-neutral-500 hover:text-dark-accent transition-colors disabled:opacity-30"
                >
                  {isUploading ? <RefreshCw className="animate-spin" size={18} /> : <Paperclip size={18} />}
                </button>
                <input
                  type="text"
                  placeholder="Intervenir como asesor humano..."
                  value={humanMessage}
                  onChange={(e) => setHumanMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendManualMessage()}
                  className="flex-1 bg-transparent border-none outline-none text-sm text-white py-2"
                />
                <button
                  onClick={() => sendManualMessage()}
                  disabled={!humanMessage.trim() || isSending}
                  className="bg-dark-accent hover:bg-dark-accent/90 text-black px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-tighter transition-all disabled:opacity-30 disabled:pointer-events-none flex items-center gap-2"
                >
                  {isSending ? <RefreshCw className="animate-spin" size={12} /> : <Zap size={12} />}
                  {isSending ? "Enviando..." : "Enviar Ahora"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-4 opacity-40">
            <div className="w-20 h-20 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-4">
              <MessageSquare size={32} />
            </div>
            <h3 className="text-xl font-serif italic text-white uppercase tracking-tighter">Selecciona una conversación</h3>
            <p className="text-[11px] text-neutral-500 uppercase tracking-widest font-bold max-w-xs">Toca un cliente en la lista para monitorear el chat de Jan o intervenir manualmente.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function OrdersTab({ orders, onUpdateStatus }: { orders: Order[], onUpdateStatus: (id: string, s: Order['status']) => void, key?: string }) {
  const downloadCSV = () => {
    if (orders.length === 0) return;
    
    // Headers for Dropi (typical format)
    const headers = ["Fecha", "Cliente", "Telefono", "Producto", "Unidades", "Direccion", "Indicacion", "Ciudad", "Total", "Status"];
    const rows = orders.map(o => [
      safeFormat(o.createdAt, 'yyyy-MM-dd HH:mm'),
      o.customerName,
      o.customerPhone,
      o.productName,
      o.quantity,
      o.address,
      o.addressIndicator || "N/A",
      o.city,
      o.totalPrice,
      o.status
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `pedidos_jan_vanegas_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
      <div className="flex justify-between items-center px-2">
        <h3 className="text-dark-accent text-[11px] font-black uppercase tracking-[0.2em] leading-none">Listado de Ventas</h3>
        <button 
          onClick={downloadCSV}
          disabled={orders.length === 0}
          className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all active:scale-95 disabled:opacity-30"
        >
          <Database size={12} className="text-dark-accent" />
          Descargar para Dropi (CSV)
        </button>
      </div>

      <div className="bg-[#111] border border-neutral-800 rounded-2xl overflow-hidden ring-1 ring-white/5">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-[11px] min-w-[700px] lg:min-w-0">
             <thead>
               <tr className="bg-neutral-900 border-b border-neutral-800 font-serif italic text-dark-accent">
                 <th className="p-4 uppercase tracking-tighter text-[10px]">Fecha</th>
                 <th className="p-4 uppercase tracking-tighter text-[10px]">Cliente</th>
                 <th className="p-4 uppercase tracking-tighter text-[10px]">Contacto</th>
                 <th className="p-4 uppercase tracking-tighter text-[10px]">Producto</th>
                 <th className="p-4 uppercase tracking-tighter text-[10px]">Total</th>
                 <th className="p-4 uppercase tracking-tighter text-[10px]">Dirección</th>
                 <th className="p-4 uppercase tracking-tighter text-[10px]">Estado</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-neutral-800">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-white/5 transition-colors group">
                    <td className="p-4 text-neutral-500">
                      {safeFormat(o.createdAt, 'dd MMM, HH:mm')}
                    </td>
                    <td className="p-4 font-bold text-white uppercase">{o.customerName}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                         <Phone size={10} className="text-dark-green" />
                         {o.customerPhone}
                      </div>
                    </td>
                    <td className="p-4">{o.productName} (x{o.quantity})</td>
                    <td className="p-4 font-mono text-dark-green font-bold">${o.totalPrice?.toLocaleString()}</td>
                    <td className="p-4 text-neutral-400">
                      <div className="flex flex-col">
                        <div className="flex items-start gap-1 capitalize">
                          <MapPin size={10} className="mt-0.5 shrink-0" />
                          <span className="truncate max-w-[150px]">{o.address}, {o.city}</span>
                        </div>
                        {o.addressIndicator && (
                          <span className="text-[9px] text-dark-accent/60 lowercase italic ml-4 leading-tight">
                            Ref: {o.addressIndicator}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                       <select 
                         value={o.status}
                         onChange={(e) => onUpdateStatus(o.id, e.target.value as any)}
                         className={cn(
                           "bg-black border border-neutral-800 rounded-lg p-1.5 text-[9px] uppercase font-black outline-none cursor-pointer hover:border-dark-accent transition-colors",
                           o.status === 'pendiente' ? 'text-dark-accent' : 'text-dark-green'
                         )}
                       >
                         <option value="pendiente">Pendiente</option>
                         <option value="despachado">Despachado</option>
                         <option value="entregado">Entregado</option>
                       </select>
                    </td>
                  </tr>
                ))}
             </tbody>
          </table>
          {orders.length === 0 && (
            <div className="p-20 text-center space-y-3">
              <ShoppingBag className="mx-auto text-neutral-800 w-12 h-12" />
              <p className="text-neutral-600 text-[10px] uppercase font-bold">Esperando que Jan cierre el primer pedido...</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function InventoryTab({ products, onUpdateStock, onReset, isResetting }: { products: Product[], onUpdateStock: (id: string, s: number) => void, onReset: () => void, isResetting: boolean, key?: string }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("todas");
  const [showManualLoad, setShowManualLoad] = useState(false);
  const [manualJson, setManualJson] = useState("");
  const [loadingManual, setLoadingManual] = useState(false);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);

  const handleManualLoad = async () => {
    if (!manualJson) return;
    setLoadingManual(true);
    try {
      const catalog = JSON.parse(manualJson);
      const res = await fetch("/api/admin/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catalog })
      });
      const data = await res.json();
      if (data.success) {
        alert("✅ Catálogo actualizado con éxito.");
        setShowManualLoad(false);
        setManualJson("");
      } else {
        alert("❌ Error: " + data.error);
      }
    } catch (e: any) {
      alert("❌ JSON Inválido: " + e.message);
    } finally {
      setLoadingManual(false);
    }
  };

  const categories = ["todas", ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  const handleImageUpload = async (p: Product, file: File) => {
    if (!file || !p.docId) return;
    
    setUploadingDocId(p.docId);
    const toastId = toast.loading(`Subiendo imagen para ${p.name}...`);
    
    // Timeout for upload to avoid immortal spinners
    const uploadTimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Timeout de subida")), 15000)
    );

    try {
      const targetId = p.docId;
      const storageRef = ref(storage, `products/${targetId}`);
      
      console.log(`[Inventory] Uploading image for ${targetId}...`);
      
      const uploadTask = uploadBytes(storageRef, file);
      const snapshot = await Promise.race([uploadTask, uploadTimeout]) as any;
      const url = await getDownloadURL(snapshot.ref);
      
      console.log(`[Inventory] Download URL: ${url}`);
      
      await updateDoc(doc(db, "products", targetId), { 
        imageUrl: url,
        updatedAt: serverTimestamp() 
      });
      
      console.log(`[Inventory] Firestore updated for ${targetId}`);
      toast.success("¡Imagen actualizada con éxito!", { id: toastId });
    } catch (err: any) {
      console.error("Error uploading image:", err);
      toast.error(`Error al subir imagen: ${err.message || 'Error desconocido'}`, { id: toastId });
    } finally {
      setUploadingDocId(null);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === "todas" || p.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-4">
        <div>
          <h3 className="text-dark-accent text-[11px] font-black uppercase tracking-[0.2em] mb-1 leading-none">Control de Inventario Pro</h3>
          <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Base de datos sincronizada vía Firebase</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
             <input 
               type="text" 
               placeholder="Buscar producto..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2 text-[11px] text-white focus:outline-none focus:border-dark-accent transition-colors"
             />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded-xl border border-neutral-800 overflow-x-auto max-w-[300px] no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[9px] uppercase font-black transition-all whitespace-nowrap",
                  activeCategory === cat ? "bg-dark-accent text-black" : "text-neutral-500 hover:text-white"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          <button 
            onClick={() => setShowManualLoad(true)}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-neutral-800 text-neutral-400 text-[10px] font-black rounded-xl hover:bg-neutral-800 hover:text-white transition-all whitespace-nowrap"
          >
            <Database size={14} /> CARGA MANUAL
          </button>

          <button 
            onClick={onReset}
            disabled={isResetting}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-neutral-800 text-neutral-400 text-[10px] font-black rounded-xl hover:bg-neutral-800 hover:text-white transition-all disabled:opacity-50 whitespace-nowrap"
          >
            <RefreshCw size={14} className={cn(isResetting && "animate-spin")} /> {isResetting ? "CARGANDO..." : "SINCRONIZAR"}
          </button>

          <button className="flex items-center gap-2 px-4 py-2 bg-dark-accent text-black text-[10px] font-black rounded-xl hover:scale-105 transition-all shadow-[0_4px_15px_rgba(242,125,38,0.2)] whitespace-nowrap">
            <Plus size={14} /> NUEVO
          </button>
        </div>
      </div>
      
      {/* Manual Load Modal */}
      <AnimatePresence>
        {showManualLoad && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowManualLoad(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-neutral-900 border border-neutral-800 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl p-8 space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-dark-accent font-black uppercase text-xs tracking-widest">Carga Manual de Catálogo</h3>
                  <p className="text-[10px] text-neutral-500 mt-1">Pega el JSON de productos. 🔴 IMPORTANTE: Para enviar la foto real, añade el campo <strong className="text-white">"imageUrl": "https://enlace_a_la_foto.jpg"</strong> en cada producto.</p>
                </div>
                <button onClick={() => setShowManualLoad(false)} className="text-neutral-500 hover:text-white">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>

              <textarea 
                value={manualJson}
                onChange={(e) => setManualJson(e.target.value)}
                placeholder='{ "products": [ { "id": "prod1", "name": "...", "price": 1000, "imageUrl": "https://..." } ] }'
                className="w-full h-80 bg-black border border-neutral-800 rounded-2xl p-6 font-mono text-[11px] text-neutral-400 focus:outline-none focus:border-dark-accent transition-all leading-relaxed no-scrollbar"
              />

              <div className="flex items-center gap-3">
                <button 
                  onClick={handleManualLoad}
                  disabled={loadingManual || !manualJson}
                  className="flex-1 bg-dark-accent text-black py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white transition-all disabled:opacity-50 shadow-xl shadow-dark-accent/10"
                >
                  {loadingManual ? "PROCESANDO..." : "ACTUALIZAR BASE DE DATOS"}
                </button>
                <button 
                  onClick={() => {
                    const template = { products: [{ id: "ejemplo-1", category: "autos", name: "Producto de Ejemplo", description: "Descripción...", cost: 10000, freight: 5000, price: 25000, stock: 10, currency: "COP" }] };
                    setManualJson(JSON.stringify(template, null, 2));
                  }}
                  className="bg-neutral-800 text-neutral-400 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-neutral-700 transition-all"
                >
                  CARGAR PLANTILLA
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="bg-[#111] border border-neutral-800 rounded-2xl overflow-hidden ring-1 ring-white/5">
        <div className="overflow-x-auto no-scrollbar text-[11px]">
          <table className="w-full text-left min-w-[900px] lg:min-w-0">
             <thead className="bg-neutral-900 border-b border-neutral-800">
               <tr className="font-serif italic text-dark-accent">
                 <th className="p-5 uppercase tracking-tighter text-[10px]">Producto</th>
                 <th className="p-5 uppercase tracking-tighter text-[10px]">Categoría</th>
                 <th className="p-5 uppercase tracking-tighter text-[10px]">Proveedor</th>
                 <th className="p-5 uppercase tracking-tighter text-[10px]">Precio Venta</th>
                 <th className="p-5 uppercase tracking-tighter text-[10px]">Stock Actual</th>
                 <th className="p-5 uppercase tracking-tighter text-[10px]">Estatus</th>
                  <th className="p-5 uppercase tracking-tighter text-[10px]">Costo Prov.</th>
                  <th className="p-5 uppercase tracking-tighter text-[10px]">Flete</th>
                  <th className="p-5 uppercase tracking-tighter text-[10px] text-dark-accent">Ganancia</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-neutral-800">
                {filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-white/5 transition-colors group">
                    <td className="p-5">
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center border border-white/5 text-neutral-500 overflow-hidden group-hover:border-dark-accent/30 transition-all">
                           {p.imageUrl ? 
                              <img src={p.imageUrl} alt={p.name} className={cn("w-full h-full object-cover transition-transform duration-500 group-hover:scale-110", uploadingDocId === p.docId && "opacity-20 blur-[2px]")} /> :
                              <Box size={16} />
                           }
                           {uploadingDocId === p.docId && (
                             <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                               <RefreshCw size={14} className="text-dark-accent animate-spin" />
                             </div>
                           )}
                        </div>
                        <div>
                          <p className="font-bold text-white uppercase whitespace-nowrap text-[11px] group-hover:text-dark-accent transition-colors">{p.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <label className={cn(
                              "cursor-pointer text-[9px] font-black uppercase transition-all flex items-center gap-1",
                              uploadingDocId === p.docId ? "text-neutral-600 pointer-events-none" : "text-dark-accent hover:text-white"
                            )}>
                              {uploadingDocId === p.docId ? (
                                <>
                                  <RefreshCw size={10} className="animate-spin" />
                                  SUBIENDO...
                                </>
                              ) : (
                                <>
                                  <ImageIcon size={10} />
                                  CAMBIAR FOTO
                                </>
                              )}
                              <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                disabled={uploadingDocId !== null}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleImageUpload(p, file);
                                  e.target.value = ''; // Reset input
                                }} 
                              />
                            </label>
                            <span className="text-[9px] text-neutral-700">|</span>
                            <span className="text-[9px] text-neutral-600 font-mono">{p.id}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-5">
                      <span className="bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded text-[8px] uppercase font-bold tracking-widest">{p.category || 'N/A'}</span>
                    </td>
                    <td className="p-5 text-neutral-500 uppercase">{p.provider || 'Dropi'}</td>
                    <td className="p-5 font-mono text-dark-green font-bold text-sm">${p.price.toLocaleString()}</td>
                    <td className="p-5">
                       <div className="flex items-center gap-4">
                          <button 
                            onClick={() => onUpdateStock(p.docId!, p.stock - 1)}
                            className="w-7 h-7 rounded-lg bg-neutral-800 flex items-center justify-center hover:bg-neutral-700 active:scale-90 text-white transition-all font-bold"
                          >-</button>
                          <span className={cn("font-bold text-lg min-w-[2ch] text-center", p.stock < 5 ? 'text-red-400' : 'text-white')}>
                            {p.stock}
                          </span>
                          <button 
                            onClick={() => onUpdateStock(p.docId!, p.stock + 1)}
                            className="w-7 h-7 rounded-lg bg-neutral-800 flex items-center justify-center hover:bg-neutral-700 active:scale-90 text-white transition-all font-bold"
                          >+</button>
                       </div>
                    </td>
                    <td className="p-5 whitespace-nowrap">
                       {p.stock <= 0 ? (
                         <span className="flex items-center gap-2 text-red-500 text-[9px] font-black uppercase"><AlertTriangle size={12}/> AGOTADO</span>
                       ) : (
                         <span className="flex items-center gap-2 text-dark-green text-[9px] font-black uppercase"><CheckCircle size={12}/> COMPLETO</span>
                       )}
                    </td>
                    <td className="p-5 font-mono text-neutral-400">
                       ${(p.cost || 0).toLocaleString()}
                    </td>
                    <td className="p-5 font-mono text-neutral-400">
                       ${(p.freight || 15000).toLocaleString()}
                    </td>
                    <td className="p-5">
                      <div className="flex flex-col">
                        <span className="font-mono text-dark-accent font-black text-sm">
                          ${(p.price - (p.cost || 0) - (p.freight || 15000)).toLocaleString()}
                        </span>
                        <span className="text-[8px] text-neutral-600 uppercase font-bold tracking-tighter">Utilidad neta</span>
                      </div>
                    </td>
                  </tr>
                ))}
             </tbody>
          </table>
          {filteredProducts.length === 0 && (
            <div className="p-20 text-center space-y-4">
              <Database className="mx-auto text-neutral-800 w-12 h-12" />
              <p className="text-neutral-600 text-[10px] uppercase font-bold">
                {products.length === 0 ? "No hay catálogo en la nube." : "No se encontraron productos."}
              </p>
              {products.length === 0 && (
                <button 
                  onClick={onReset}
                  disabled={isResetting}
                  className="bg-dark-accent text-black px-6 py-2 rounded-xl text-[10px] font-bold uppercase transition-all hover:scale-105 disabled:opacity-50"
                >
                  {isResetting ? "Sincronizando..." : "SINCRONIZAR CATÁLOGO"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function MonitorTab({ activities }: { activities: Activity[], key?: string }) {
  const formatTime = (ts: any) => {
    return safeFormat(ts, "HH:mm:ss");
  };

  const getDuration = (start: any, end: any) => {
    if (!start || !end) return null;
    try {
      const s = start.toDate ? start.toDate().getTime() : new Date(start).getTime();
      const e = end.toDate ? end.toDate().getTime() : new Date(end).getTime();
      if (isNaN(s) || isNaN(e)) return "--:--";
      return ((e - s) / 1000).toFixed(1) + "s";
    } catch (e) {
      return "--:--";
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-3xl overflow-hidden backdrop-blur-sm">
        <div className="p-6 border-b border-neutral-800 bg-black/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-dark-accent/10 flex items-center justify-center border border-dark-accent/20">
              <Clock className="w-4 h-4 text-dark-accent" />
            </div>
            <div>
              <h3 className="text-white text-xs font-black uppercase tracking-widest">Monitor de Respuesta Jan</h3>
              <p className="text-[10px] text-neutral-500">Auditoría de tiempos de procesamiento y errores.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-dark-green animate-pulse" />
            <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Escaneando Hook...</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black/40 border-b border-neutral-800">
                <th className="px-6 py-4 text-[9px] font-black text-neutral-500 uppercase tracking-widest">Cliente / Mensaje</th>
                <th className="px-6 py-4 text-[9px] font-black text-neutral-500 uppercase tracking-widest text-center">Recibido</th>
                <th className="px-6 py-4 text-[9px] font-black text-neutral-500 uppercase tracking-widest text-center">Proceso</th>
                <th className="px-6 py-4 text-[9px] font-black text-neutral-500 uppercase tracking-widest text-center">Respuesta</th>
                <th className="px-6 py-4 text-[9px] font-black text-neutral-500 uppercase tracking-widest text-center">Duración</th>
                <th className="px-6 py-4 text-[9px] font-black text-neutral-500 uppercase tracking-widest">Estado / Log</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {activities.map((item) => (
                <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-white uppercase tracking-tight mb-1">{(item.from || "unknown").replace("whatsapp:", "")}</span>
                      <p className="text-[11px] text-neutral-400 italic line-clamp-1 max-w-xs group-hover:text-neutral-200 transition-colors">
                        "{item.message}"
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center font-mono text-[10px] text-neutral-500">{formatTime(item.receivedAt || item.timestamp)}</td>
                  <td className="px-6 py-5 text-center font-mono text-[10px] text-neutral-500">{formatTime(item.processingAt)}</td>
                  <td className="px-6 py-5 text-center font-mono text-[10px] text-neutral-500">{formatTime(item.respondedAt)}</td>
                  <td className="px-6 py-5 text-center">
                    <span className="text-[10px] font-black text-dark-accent bg-dark-accent/5 px-2 py-0.5 rounded border border-dark-accent/10">
                      {getDuration(item.receivedAt || item.timestamp, item.respondedAt || item.errorAt) || "..."}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        item.status === 'respondido' ? 'bg-dark-green' :
                        item.status === 'error' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' :
                        'bg-dark-accent animate-pulse'
                      )} />
                      <div className="flex flex-col min-w-0">
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-widest",
                          item.status === 'error' ? 'text-red-400' : 'text-neutral-300'
                        )}>
                          {item.status}
                        </span>
                        {item.status === 'error' && (
                          <span className="text-[9px] text-red-900/80 truncate max-w-[150px] font-mono leading-none mt-1">
                            {item.response || "Error técnico"}
                          </span>
                        )}
                        {item.status === 'respondido' && (
                          <span className="text-[9px] text-neutral-600 truncate max-w-[150px] italic leading-none mt-1">
                            {item.response}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {activities.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-20">
                      <Database size={32} />
                      <p className="text-[10px] font-black uppercase tracking-[0.3em]">Esperando activad de WhatsApp...</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-dark-accent/5 border border-dark-accent/10 p-6 rounded-2xl flex items-start gap-4 ring-1 ring-white/5">
        <AlertTriangle className="text-dark-accent w-5 h-5 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-white text-xs font-bold uppercase tracking-widest">Guía de Auditoría</h4>
          <p className="text-[11px] text-neutral-500 leading-relaxed">
            Si ves un estado en <span className="text-red-400 font-bold">ROJO</span>, el log te dirá si falló la API de Gemini o si Twilio rechazó el mensaje. 
            El tiempo ideal de respuesta debe ser menor a <span className="text-white font-mono">15.0s</span> para mantener la fluidez del chat.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function RecoveryTab({ activities, onSelectUser }: { activities: Activity[], onSelectUser: (phone: string) => void, key?: string }) {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        // Find users whose last status was 'recibido' (abandoned)
        const userMap = new Map();
        activities.forEach(a => {
          if (a.from && !userMap.has(a.from)) {
            userMap.set(a.from, a);
          }
        });
        
        const abandonedLeads = Array.from(userMap.values())
          .filter(a => a.status === 'recibido')
          .slice(0, 10);
          
        setLeads(abandonedLeads);
      } catch (e) {
        console.error("Error fetching leads:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchLeads();
  }, [activities]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-[#111] border border-neutral-800 p-8 rounded-2xl ring-1 ring-white/5 space-y-4">
          <div className="flex items-center gap-3 text-dark-accent mb-2">
            <Zap size={20} />
            <h3 className="text-xs font-black uppercase tracking-[0.2em]">Activación Proactiva</h3>
          </div>
          <p className="text-[11px] text-neutral-500 leading-relaxed">
            Estos clientes nos escribieron pero Jan no ha podido cerrar la venta aún. 
            Lanza un "empujoncito" automático para recuperar el interés.
          </p>
          <div className="bg-dark-accent/10 border border-dark-accent/20 p-4 rounded-xl">
             <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] text-dark-accent font-black uppercase">Ventas en Riesgo</span>
                <span className="text-xl font-serif italic text-white">{leads.length}</span>
             </div>
             <div className="w-full h-1 bg-neutral-900 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-dark-accent w-1/3 animate-pulse" />
             </div>
          </div>
        </div>

        <div className="bg-[#111] border border-neutral-800 p-8 rounded-2xl ring-1 ring-white/5 flex flex-col justify-center text-center space-y-4">
           <Truck className="mx-auto text-neutral-800 w-10 h-10" />
           <div>
              <h4 className="text-white text-xs font-bold uppercase tracking-widest">Efectividad de Jan</h4>
              <p className="text-2xl font-serif italic text-dark-accent">82%</p>
              <p className="text-[9px] text-neutral-600 uppercase font-black">Conversión de Recuperación</p>
           </div>
        </div>
      </div>

      <div className="bg-[#111] border border-neutral-800 rounded-2xl overflow-hidden ring-1 ring-white/5">
        <div className="p-6 border-b border-neutral-800 flex justify-between items-center">
           <h3 className="text-white text-[10px] font-black uppercase tracking-widest">Prospectos Abandonados</h3>
           <span className="text-[9px] text-neutral-600 font-mono">Monitor en Vivo</span>
        </div>
        <div className="divide-y divide-neutral-800">
          {leads.map((l) => (
            <div key={l.id} className="p-6 flex items-center justify-between group hover:bg-white/5 transition-all">
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500 group-hover:border-dark-accent transition-colors">
                     <User size={16} />
                  </div>
                  <div>
                     <p className="text-xs font-bold text-white uppercase">{(l.from || "unknown").replace('whatsapp:', '')}</p>
                     <p className="text-[10px] text-neutral-500 line-clamp-1 italic">"{l.message}"</p>
                  </div>
               </div>
               <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                     <p className="text-[9px] text-neutral-600 uppercase font-black">Hace</p>
                     <p className="text-[10px] text-white font-mono">15 min</p>
                  </div>
                  <button className="bg-neutral-800 hover:bg-dark-accent hover:text-black p-3 rounded-xl transition-all border border-neutral-700">
                     <RefreshCw size={14} className="group-hover:animate-spin" />
                  </button>
               </div>
            </div>
          ))}
          {leads.length === 0 && (
            <div className="p-20 text-center space-y-4">
              <CheckCircle className="mx-auto text-dark-green w-12 h-12" />
              <p className="text-neutral-600 text-[10px] uppercase font-bold tracking-widest">¡Todos los clientes están atendidos!</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function CRMTab({ customers, selectedUser, onSelectUser }: { customers: any[], selectedUser: string | null, onSelectUser: (phone: string) => void, key?: string }) {
  // Aggregate stats
  const total = customers.length;
  const inPipeline = customers.filter(c => c.etapa === 'negociando' || c.etapa === 'interesado').length;
  const highPriority = customers.filter(c => c.prioridad === 'alta').length;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Top metrics */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-[#111] border border-neutral-800 p-6 rounded-2xl ring-1 ring-white/5">
          <p className="text-[10px] uppercase font-black tracking-widest text-neutral-500 mb-2">Total Prospectos</p>
           <p className="text-3xl font-mono text-white">{total}</p>
        </div>
        <div className="bg-[#111] border border-neutral-800 p-6 rounded-2xl ring-1 ring-white/5">
          <p className="text-[10px] uppercase font-black tracking-widest text-neutral-500 mb-2">En Negociación</p>
           <p className="text-3xl font-mono text-white">{inPipeline}</p>
        </div>
        <div className="bg-dark-accent/10 border border-dark-accent/20 p-6 rounded-2xl ring-1 ring-dark-accent/30">
          <p className="text-[10px] uppercase font-black tracking-widest text-dark-accent/80 mb-2">Prioridad Alta (Score &gt; 70)</p>
           <p className="text-3xl font-mono text-dark-accent">{highPriority}</p>
        </div>
      </div>

      <div className="bg-[#111] border border-neutral-800 rounded-2xl overflow-hidden ring-1 ring-white/5">
        <div className="p-6 border-b border-neutral-800 flex justify-between items-center">
            <h3 className="text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><User size={14} /> Pipeline Activo</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/30">
                <th className="p-4 text-[10px] uppercase tracking-widest font-bold text-neutral-500 w-6"></th>
                <th className="p-4 text-[10px] uppercase tracking-widest font-bold text-neutral-500">Cliente</th>
                <th className="p-4 text-[10px] uppercase tracking-widest font-bold text-neutral-500">Etapa / Score</th>
                <th className="p-4 text-[10px] uppercase tracking-widest font-bold text-neutral-500">Intención / Producto</th>
                 <th className="p-4 text-[10px] uppercase tracking-widest font-bold text-neutral-500">Objeciones</th>
                <th className="p-4 text-[10px] uppercase tracking-widest font-bold text-neutral-500 text-right">Interacción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {customers.map(c => {
                const getEtapaColor = (etapa: string) => {
                  switch(etapa) {
                    case 'negociando': return 'from-dark-accent/20 text-dark-accent border-dark-accent/30';
                    case 'interesado': return 'from-blue-500/20 text-blue-400 border-blue-500/30';
                    default: return 'from-neutral-500/20 text-neutral-400 border-neutral-500/30';
                  }
                };
                
                const timeStr = c.ultima_interaccion?.toMillis ? new Date(c.ultima_interaccion.toMillis()).toLocaleString() : 'N/A';

                return (
                  <tr key={c.id} className="hover:bg-neutral-900/50 transition-colors group cursor-pointer" onClick={() => onSelectUser(c.id)}>
                    <td className="p-4 text-neutral-400">
                      <div className="w-8 h-8 rounded-full bg-neutral-800 flex justify-center items-center">
                        <User size={14} />
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-sm text-white">{c.name || c.id}</div>
                      <div className="text-[10px] text-neutral-500">{c.phone || c.id}</div>
                    </td>
                    <td className="p-4">
                      <span className={cn("px-2 py-1 bg-gradient-to-r text-[9px] uppercase tracking-widest font-black rounded-lg border", getEtapaColor(c.etapa))}>
                        {c.etapa || 'nuevo'}
                      </span>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 w-24 bg-neutral-800 rounded-full overflow-hidden">
                          <div className={cn("h-full", (c.score || 0) > 70 ? "bg-dark-accent" : "bg-neutral-500")} style={{ width: `${Math.min(c.score || 0, 100)}%` }}></div>
                        </div>
                        <span className="text-[10px] text-white font-mono">{Math.floor(c.score || 0)}</span>
                      </div>
                    </td>
                     <td className="p-4 max-w-[200px]">
                      <div className="font-bold text-xs text-neutral-300 truncate">{c.intencion || 'Sin detectar'}</div>
                      <div className="text-[10px] text-neutral-500 truncate">{c.producto_interes || 'Gral'}</div>
                    </td>
                     <td className="p-4 max-w-[150px]">
                        <p className="text-[10px] text-neutral-400 truncate">{c.objeciones || 'ninguna'}</p>
                     </td>
                    <td className="p-4 text-right">
                      <div className="text-[10px] font-mono text-neutral-500">{timeStr}</div>
                      <div className="text-[9px] text-neutral-600 mt-1 uppercase font-bold tracking-widest group-hover:text-dark-accent transition-colors">
                        Ver Chat →
                      </div>
                    </td>
                  </tr>
                );
              })}
              {customers.length === 0 && (
                <tr>
                   <td colSpan={6} className="p-8 text-center text-neutral-500 text-xs font-bold uppercase tracking-widest">
                     No hay prospectos en el CRM todavía.
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

function ConfigTab({ webhookUrl, copied, onCopy, onReset, isResetting, onClearTransactions, isClearing }: any) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8 max-w-4xl">
       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-[#111] border border-neutral-800 p-8 rounded-2xl space-y-6 ring-1 ring-white/5 h-fit">
             <div className="flex justify-between items-center mb-4">
               <div className="flex items-center gap-3 text-dark-accent">
                 <Zap size={20} />
                 <h3 className="text-xs font-black uppercase tracking-[0.2em]">Configuración Webhook</h3>
               </div>
               <button
                     onClick={onCopy}
                     className="p-2 bg-neutral-900 border border-neutral-800 rounded-lg hover:bg-neutral-800 transition-all text-dark-muted flex items-center gap-2 text-[10px]"
                   >
                     {copied ? <CheckCircle className="w-4 h-4 text-dark-green" /> : <Copy className="w-4 h-4" />}
                     {copied ? 'COPIADO' : 'COPIAR URL'}
               </button>
             </div>
             <p className="text-[11px] text-neutral-500 leading-relaxed">
                Jan v3.1 está listo. Pega esta URL en tu consola de Twilio Sandbox bajo <span className="text-dark-accent font-medium uppercase font-mono tracking-tighter">"WHEN A MESSAGE COMES IN"</span>.
             </p>
             <div className="bg-orange-900/10 border border-orange-900/30 p-4 rounded-xl space-y-2">
                <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest flex items-center gap-2">
                  <AlertTriangle size={12} /> Aviso de Restricción
                </p>
                <p className="text-[10px] text-neutral-500 leading-tight">
                  Las cuentas <strong>Twilio Trial</strong> están limitadas a <strong>50 mensajes diarios</strong>. Hemos optimizado a Jan para que use un solo mensaje por respuesta (texto+imagen), duplicando su capacidad, pero recuerda que este es un límite de tu cuenta de Twilio.
                </p>
             </div>
             <div className="relative">
                <div className="flex items-center p-5 bg-black/40 border border-neutral-800 rounded-xl font-mono text-[11px] ring-1 ring-white/5">
                   <span className="text-dark-accent select-all break-all">{webhookUrl}</span>
                </div>
             </div>
          </div>

          <div className="space-y-8">
             <div className="bg-[#111] border border-neutral-800 p-8 rounded-2xl space-y-4 ring-1 ring-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                   <div className="bg-dark-green/20 text-dark-green text-[8px] font-black px-2 py-0.5 rounded border border-dark-green/30 uppercase tracking-widest animate-pulse">
                      Automático
                   </div>
                </div>
                <div className="flex items-center gap-3 text-dark-accent mb-2">
                   <Truck size={20} />
                   <h3 className="text-xs font-black uppercase tracking-[0.2em]">Logística Dropi</h3>
                </div>
                <p className="text-[11px] text-neutral-500">Jan subirá los pedidos aprobados directamente a tu panel de Dropi para que salgan a despacho sin manos humanas.</p>
                <div className="p-4 bg-black/40 border border-neutral-800 rounded-xl flex items-center justify-between">
                   <span className="text-[9px] text-neutral-600 font-black uppercase tracking-widest">API Key Status</span>
                   <span className="text-[10px] text-white font-mono">DROPI_***_12345</span>
                </div>
             </div>

             <div className="bg-[#111] border border-neutral-800 p-8 rounded-2xl space-y-4 ring-1 ring-white/5 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4">
                  <div className="bg-dark-accent/20 text-dark-accent text-[8px] font-black px-2 py-0.5 rounded border border-dark-accent/30 uppercase tracking-widest">
                     Premium
                  </div>
               </div>
               <div className="flex items-center gap-3 text-dark-accent mb-2">
                  <FileText size={20} />
                  <h3 className="text-xs font-black uppercase tracking-[0.2em]">Emails Profesionales</h3>
               </div>
               <p className="text-[11px] text-neutral-500">Cada venta genera una factura profesional o guía de despacho enviada al email del cliente vía SendGrid.</p>
               <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-dark-green" />
                  <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Servicio de Notificación Activo</span>
               </div>
             </div>
          </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
         <div className="bg-red-900/10 border border-red-900/20 p-8 rounded-2xl space-y-4">
            <div>
              <h4 className="text-red-400 text-[10px] font-black uppercase tracking-widest mb-1">Zona de Peligro: Reiniciar para Ventas Reales</h4>
              <p className="text-red-900/60 text-[10px]">Borra TODOS los pedidos y actividades de prueba acumulados hasta hoy.</p>
            </div>
            <button 
              onClick={onClearTransactions}
              disabled={isClearing}
              className="w-full bg-red-500 hover:bg-red-600 text-white px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isClearing ? <RefreshCw className="animate-spin" size={14} /> : <Trash2 size={14} />}
              {isClearing ? "BORRANDO DATOS..." : "REINICIAR TABLERO (MODO REAL)"}
            </button>
         </div>

         <div className="bg-neutral-900/50 border border-neutral-800 p-8 rounded-2xl space-y-4">
            <div>
              <h4 className="text-neutral-400 text-[10px] font-black uppercase tracking-widest mb-1">Sincronización Total</h4>
              <p className="text-neutral-600 text-[10px]">Actualiza el catálogo de productos desde el servidor.</p>
            </div>
            <button 
              onClick={onReset}
              disabled={isResetting}
              className="w-full border border-neutral-800 hover:border-dark-accent text-neutral-400 hover:text-white px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isResetting ? <RefreshCw className="animate-spin" size={14} /> : <RefreshCw size={14} />}
              {isResetting ? "Reseteando..." : "Sincronizar Catálogo Ahora"}
            </button>
         </div>
       </div>
    </motion.div>
  );
}

// Global App component with Routing
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/" element={<JanAdmin />} />
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
