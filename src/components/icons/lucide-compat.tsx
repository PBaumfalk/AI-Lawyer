// Zentrale Icon-Quelle der Anwendung.
//
// Alle Importe aus "lucide-react" werden per Alias hierher umgeleitet
// (next.config.mjs: webpack und turbopack, vitest.config.ts). Dadurch
// erhält die ganze Oberfläche die Persimmon-Icons, ohne dass jede Datei
// angepasst werden muss, und neuer Code mit `import { X } from "lucide-react"`
// bekommt automatisch das richtige Icon.
//
// - Icons mit fachlicher Entsprechung im Designpaket (navigation-map.json,
//   catalog.json) werden durch die Persimmon-Form ersetzt.
// - Alle übrigen kommen weiter aus Lucide, mit derselben Strichstärke 1.75
//   (globals.css: svg.lucide). Diese Abweichung vom Contract („keine
//   Nachbarsymbole aus anderen Bibliotheken") ist dokumentiert; Ersatz
//   entsteht im Designpaket, nicht hier.
// - Waage (Scale) und KI-Funken (Sparkles) sind laut CI-Contract kein
//   Markenzeichen; Sparkles wird durch Helena ersetzt, Scale durch die
//   Aktenmappe (fachlich: Mandat/Akte).
import * as React from "react";
import type { LucideProps } from "lucide-react";
import { Icon, type IconName } from "./persimmon";

// Original-Paket über den ESM-Einstieg (der Alias greift nur auf den exakten
// Namen "lucide-react").
export * from "lucide-react/dist/esm/lucide-react.js";

function persimmon(name: IconName, displayName: string, rotate?: number) {
  const C = React.forwardRef<SVGSVGElement, LucideProps>(function PersimmonLucide(
    // `name` and `rotate` are generic SVG attributes in LucideProps; they must
    // not override the icon identity or the derived rotation.
    { size, strokeWidth, absoluteStrokeWidth, className, name: _svgName, rotate: _svgRotate, ...rest },
    ref
  ) {
    return (
      <Icon
        {...(rest as Omit<React.SVGProps<SVGSVGElement>, "ref">)}
        ref={ref}
        name={name}
        size={size ?? 24}
        strokeWidth={strokeWidth ?? 1.75}
        absoluteStrokeWidth={absoluteStrokeWidth}
        rotate={rotate}
        className={["lucide", `lucide-${displayName.toLowerCase()}`, className].filter(Boolean).join(" ")}
      />
    );
  });
  C.displayName = displayName;
  return C;
}

/** Zuordnung Lucide-Name → Persimmon-Icon (Bedeutung, nicht Aussehen). */
export const LUCIDE_ZU_PERSIMMON = {
  // Navigation (navigation-map.json)
  LayoutDashboard: "dashboard",
  FolderOpen: "cases",
  Folder: "cases",
  Users: "contacts",
  Calendar: "calendar",
  CalendarDays: "calendar",
  FileText: "documents",
  File: "documents",
  FileEdit: "drafts",
  FilePenLine: "drafts",
  AlertTriangle: "alerts",
  AlertCircle: "alerts",
  Mail: "email",
  Ticket: "tickets",
  TicketCheck: "tickets",
  Bot: "helena",
  Sparkles: "helena",
  Wallet: "finances",
  BarChart3: "analytics",
  MessageSquare: "messages",
  // Aktionen und Zustände
  Search: "search",
  Plus: "plus",
  Minus: "minus",
  X: "close",
  Check: "check",
  CheckCircle: "check-circle",
  CheckCircle2: "check-circle",
  Clock: "clock",
  History: "history",
  Settings: "settings",
  Sun: "sun",
  Moon: "moon",
  LogOut: "logout",
  User: "user",
  UserRound: "user",
  UserCircle: "user",
  Bell: "notification",
  Upload: "upload",
  Download: "download",
  Save: "save",
  Pencil: "edit",
  Edit: "edit",
  Edit2: "edit",
  Edit3: "edit",
  PenLine: "edit",
  Trash2: "trash",
  Copy: "copy",
  Link: "link",
  Link2: "link",
  Paperclip: "attachment",
  Filter: "filter",
  ArrowUpDown: "sort",
  MoreHorizontal: "more",
  ChevronLeft: "chevron-left",
  ChevronRight: "chevron-right",
  ChevronDown: "chevron-down",
  ArrowLeft: "arrow-left",
  ArrowRight: "arrow-right",
  ArrowUp: "arrow-up",
  ArrowDown: "arrow-down",
  RefreshCw: "refresh",
  RotateCw: "refresh",
  Loader2: "loading",
  Lock: "lock",
  LockOpen: "unlock",
  Shield: "shield",
  Info: "info",
  HelpCircle: "help",
  Eye: "eye",
  EyeOff: "eye-off",
  Star: "star",
  Archive: "archive",
  Scale: "briefcase",
  Phone: "phone",
  MapPin: "location",
  Building2: "building",
  Send: "send",
  Play: "play",
  Pause: "pause",
  Timer: "timer",
  Receipt: "invoice",
  Banknote: "euro",
  BookOpen: "knowledge",
  FileSignature: "signature",
  Workflow: "workflow",
  Maximize: "expand",
  Maximize2: "expand",
  Minimize: "collapse",
  Minimize2: "collapse",
} as const satisfies Record<string, IconName>;

export const LayoutDashboard = persimmon("dashboard", "LayoutDashboard");
export const FolderOpen = persimmon("cases", "FolderOpen");
export const Folder = persimmon("cases", "Folder");
export const Users = persimmon("contacts", "Users");
export const Calendar = persimmon("calendar", "Calendar");
export const CalendarDays = persimmon("calendar", "CalendarDays");
export const FileText = persimmon("documents", "FileText");
export const File = persimmon("documents", "File");
export const FileEdit = persimmon("drafts", "FileEdit");
export const FilePenLine = persimmon("drafts", "FilePenLine");
export const AlertTriangle = persimmon("alerts", "AlertTriangle");
export const AlertCircle = persimmon("alerts", "AlertCircle");
export const Mail = persimmon("email", "Mail");
export const Ticket = persimmon("tickets", "Ticket");
export const TicketCheck = persimmon("tickets", "TicketCheck");
export const Bot = persimmon("helena", "Bot");
export const Sparkles = persimmon("helena", "Sparkles");
export const Wallet = persimmon("finances", "Wallet");
export const BarChart3 = persimmon("analytics", "BarChart3");
export const MessageSquare = persimmon("messages", "MessageSquare");
export const Search = persimmon("search", "Search");
export const Plus = persimmon("plus", "Plus");
export const Minus = persimmon("minus", "Minus");
export const X = persimmon("close", "X");
export const Check = persimmon("check", "Check");
export const CheckCircle = persimmon("check-circle", "CheckCircle");
export const CheckCircle2 = persimmon("check-circle", "CheckCircle2");
export const Clock = persimmon("clock", "Clock");
export const History = persimmon("history", "History");
export const Settings = persimmon("settings", "Settings");
export const Sun = persimmon("sun", "Sun");
export const Moon = persimmon("moon", "Moon");
export const LogOut = persimmon("logout", "LogOut");
export const User = persimmon("user", "User");
export const UserRound = persimmon("user", "UserRound");
export const UserCircle = persimmon("user", "UserCircle");
export const Bell = persimmon("notification", "Bell");
export const Upload = persimmon("upload", "Upload");
export const Download = persimmon("download", "Download");
export const Save = persimmon("save", "Save");
export const Pencil = persimmon("edit", "Pencil");
export const Edit = persimmon("edit", "Edit");
export const Edit2 = persimmon("edit", "Edit2");
export const Edit3 = persimmon("edit", "Edit3");
export const PenLine = persimmon("edit", "PenLine");
export const Trash2 = persimmon("trash", "Trash2");
export const Copy = persimmon("copy", "Copy");
export const Link = persimmon("link", "Link");
export const Link2 = persimmon("link", "Link2");
export const Paperclip = persimmon("attachment", "Paperclip");
export const Filter = persimmon("filter", "Filter");
export const ArrowUpDown = persimmon("sort", "ArrowUpDown");
export const MoreHorizontal = persimmon("more", "MoreHorizontal");
export const ChevronLeft = persimmon("chevron-left", "ChevronLeft");
export const ChevronRight = persimmon("chevron-right", "ChevronRight");
export const ChevronDown = persimmon("chevron-down", "ChevronDown");
export const ChevronUp = persimmon("chevron-down", "ChevronUp", 180);
export const ArrowLeft = persimmon("arrow-left", "ArrowLeft");
export const ArrowRight = persimmon("arrow-right", "ArrowRight");
export const ArrowUp = persimmon("arrow-up", "ArrowUp");
export const ArrowDown = persimmon("arrow-down", "ArrowDown");
export const RefreshCw = persimmon("refresh", "RefreshCw");
export const RotateCw = persimmon("refresh", "RotateCw");
export const Loader2 = persimmon("loading", "Loader2");
export const Lock = persimmon("lock", "Lock");
export const LockOpen = persimmon("unlock", "LockOpen");
export const Shield = persimmon("shield", "Shield");
export const Info = persimmon("info", "Info");
export const HelpCircle = persimmon("help", "HelpCircle");
export const Eye = persimmon("eye", "Eye");
export const EyeOff = persimmon("eye-off", "EyeOff");
export const Star = persimmon("star", "Star");
export const Archive = persimmon("archive", "Archive");
export const Scale = persimmon("briefcase", "Scale");
export const Phone = persimmon("phone", "Phone");
export const MapPin = persimmon("location", "MapPin");
export const Building2 = persimmon("building", "Building2");
export const Send = persimmon("send", "Send");
export const Play = persimmon("play", "Play");
export const Pause = persimmon("pause", "Pause");
export const Timer = persimmon("timer", "Timer");
export const Receipt = persimmon("invoice", "Receipt");
export const Banknote = persimmon("euro", "Banknote");
export const BookOpen = persimmon("knowledge", "BookOpen");
export const FileSignature = persimmon("signature", "FileSignature");
export const Workflow = persimmon("workflow", "Workflow");
export const Maximize = persimmon("expand", "Maximize");
export const Maximize2 = persimmon("expand", "Maximize2");
export const Minimize = persimmon("collapse", "Minimize");
export const Minimize2 = persimmon("collapse", "Minimize2");
