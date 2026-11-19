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
// - Namen ohne Entsprechung im Paket erhalten ein Erweiterungsicon im
//   Persimmon-Stil (persimmon-erweiterung.tsx, eigene Geometrie nach
//   CI-Contract §5). Einige Formen sind gedreht abgeleitet (LUCIDE_GEDREHT).
// - Jeder in der Anwendung verwendete Name ist hier zugeordnet; der Test
//   icons.test.tsx schlägt fehl, sobald ein neuer Name nackt aus Lucide
//   käme. Neue Namen: zuordnen oder ein Erweiterungsicon zeichnen.
// - Der Stern-Export unten bleibt nur als Rückfall für Typen und künftige
//   Namen; in der Oberfläche erscheint kein Lucide-Icon mehr.
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
  Wand2: "edit", // beA: typografische Zeichen ersetzen (keine KI, daher nicht Helena)
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
  // Weitere Zuordnungen auf Paket-Icons (fachlich gleichwertig)
  ShieldCheck: "shield",
  ContactRound: "user",
  ExternalLink: "source",
  FileDown: "download",
  FileUp: "upload",
  FileOutput: "export",
  FileWarning: "alerts",
  GitBranch: "workflow",
  Brain: "helena",
  ScrollText: "history",
  Square: "stop",
  Wrench: "settings",
  // Erweiterungsicons im Persimmon-Stil (persimmon-erweiterung.tsx)
  Activity: "activity",
  ArrowRightLeft: "swap",
  Calculator: "calculator",
  Camera: "camera",
  CheckCheck: "check-double",
  CheckSquare: "check-square",
  ChevronsLeft: "chevrons-left",
  ClipboardList: "clipboard",
  ClipboardCheck: "clipboard-check",
  Combine: "merge",
  Columns2: "columns",
  Cpu: "cpu",
  CreditCard: "card",
  Crown: "crown",
  Database: "database",
  FileCheck: "file-check",
  FileCheck2: "file-check",
  FilePlus2: "file-plus",
  FileSearch: "file-search",
  FileX: "file-x",
  FileSpreadsheet: "file-table",
  FileJson: "file-code",
  FileQuestion: "file-question",
  FileBarChart: "file-chart",
  FileImage: "image",
  FolderPlus: "folder-plus",
  FolderInput: "folder-in",
  FolderTree: "folder-tree",
  Reply: "reply",
  ReplyAll: "reply-all",
  Forward: "forward",
  Gavel: "court",
  Landmark: "court",
  Gem: "gem",
  Globe: "globe",
  GripVertical: "grip",
  Hash: "hash",
  Heart: "heart",
  IdCard: "id-card",
  Image: "image",
  ImagePlus: "image",
  Inbox: "inbox",
  KeyRound: "key",
  FileKey2: "key", // beA-Software-Token-Datei (feat/bea-expert)
  MailOpen: "mail-open",
  MinusCircle: "minus-circle",
  XCircle: "x-circle",
  PanelLeft: "panel-left",
  PanelLeftClose: "panel-left-close",
  Palette: "palette",
  Plug: "plug",
  Printer: "printer",
  RotateCcw: "undo",
  Undo2: "undo",
  Scissors: "scissors",
  Server: "server",
  HardDrive: "server",
  ShieldAlert: "shield-alert",
  ShieldOff: "shield-off",
  ShieldBan: "shield-off",
  StickyNote: "note",
  Swords: "swords",
  Table: "table",
  Tag: "tag",
  Target: "target",
  ThumbsUp: "thumbs-up",
  TrendingUp: "trend-up",
  TrendingDown: "trend-down",
  Trophy: "trophy",
  Frame: "frame",
  Flame: "flame",
  Skull: "skull",
  ShoppingBag: "shop",
  Store: "shop",
  SlidersHorizontal: "sliders",
  Stamp: "stamp",
  Lightbulb: "idea",
  Bug: "bug",
  UserCheck: "user-check",
  UserMinus: "user-minus",
  UserPlus: "user-plus",
  UserCog: "user-cog",
  Wifi: "wifi",
  WifiOff: "wifi-off",
  Zap: "zap",
  ZoomIn: "zoom-in",
  ZoomOut: "zoom-out",
  Bold: "bold",
  Italic: "italic",
  Underline: "underline",
  Strikethrough: "strikethrough",
  Heading1: "heading-1",
  Heading2: "heading-2",
  Heading3: "heading-3",
  List: "list",
  ListOrdered: "list-ordered",
  Quote: "quote",
  Code: "code",
  Type: "text",
} as const satisfies Record<string, IconName>;

/** Abgeleitete Formen: Lucide-Name → [Icon, Drehung in Grad]. */
export const LUCIDE_GEDREHT = {
  ChevronUp: ["chevron-down", 180],
  MoreVertical: ["more", 90],
  GripHorizontal: ["grip", 90],
  ChevronsRight: ["chevrons-left", 180],
  ThumbsDown: ["thumbs-up", 180],
  ArrowUpRight: ["arrow-right", 315],
  ArrowDownRight: ["arrow-right", 45],
  ArrowDownLeft: ["arrow-right", 135],
} as const satisfies Record<string, readonly [IconName, number]>;

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
export const Wand2 = persimmon("edit", "Wand2");
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
export const ShieldCheck = persimmon("shield", "ShieldCheck");
export const ContactRound = persimmon("user", "ContactRound");
export const ExternalLink = persimmon("source", "ExternalLink");
export const FileDown = persimmon("download", "FileDown");
export const FileUp = persimmon("upload", "FileUp");
export const FileOutput = persimmon("export", "FileOutput");
export const FileWarning = persimmon("alerts", "FileWarning");
export const GitBranch = persimmon("workflow", "GitBranch");
export const Brain = persimmon("helena", "Brain");
export const ScrollText = persimmon("history", "ScrollText");
export const Square = persimmon("stop", "Square");
export const Wrench = persimmon("settings", "Wrench");
export const Activity = persimmon("activity", "Activity");
export const ArrowRightLeft = persimmon("swap", "ArrowRightLeft");
export const Calculator = persimmon("calculator", "Calculator");
export const Camera = persimmon("camera", "Camera");
export const CheckCheck = persimmon("check-double", "CheckCheck");
export const CheckSquare = persimmon("check-square", "CheckSquare");
export const ChevronsLeft = persimmon("chevrons-left", "ChevronsLeft");
export const ClipboardList = persimmon("clipboard", "ClipboardList");
export const ClipboardCheck = persimmon("clipboard-check", "ClipboardCheck");
export const Combine = persimmon("merge", "Combine");
export const Columns2 = persimmon("columns", "Columns2");
export const Cpu = persimmon("cpu", "Cpu");
export const CreditCard = persimmon("card", "CreditCard");
export const Crown = persimmon("crown", "Crown");
export const Database = persimmon("database", "Database");
export const FileCheck = persimmon("file-check", "FileCheck");
export const FileCheck2 = persimmon("file-check", "FileCheck2");
export const FilePlus2 = persimmon("file-plus", "FilePlus2");
export const FileSearch = persimmon("file-search", "FileSearch");
export const FileX = persimmon("file-x", "FileX");
export const FileSpreadsheet = persimmon("file-table", "FileSpreadsheet");
export const FileJson = persimmon("file-code", "FileJson");
export const FileQuestion = persimmon("file-question", "FileQuestion");
export const FileBarChart = persimmon("file-chart", "FileBarChart");
export const FileImage = persimmon("image", "FileImage");
export const FolderPlus = persimmon("folder-plus", "FolderPlus");
export const FolderInput = persimmon("folder-in", "FolderInput");
export const FolderTree = persimmon("folder-tree", "FolderTree");
export const Reply = persimmon("reply", "Reply");
export const ReplyAll = persimmon("reply-all", "ReplyAll");
export const Forward = persimmon("forward", "Forward");
export const Gavel = persimmon("court", "Gavel");
export const Landmark = persimmon("court", "Landmark");
export const Gem = persimmon("gem", "Gem");
export const Globe = persimmon("globe", "Globe");
export const GripVertical = persimmon("grip", "GripVertical");
export const Hash = persimmon("hash", "Hash");
export const Heart = persimmon("heart", "Heart");
export const IdCard = persimmon("id-card", "IdCard");
export const Image = persimmon("image", "Image");
export const ImagePlus = persimmon("image", "ImagePlus");
export const Inbox = persimmon("inbox", "Inbox");
export const KeyRound = persimmon("key", "KeyRound");
export const FileKey2 = persimmon("key", "FileKey2");
export const MailOpen = persimmon("mail-open", "MailOpen");
export const MinusCircle = persimmon("minus-circle", "MinusCircle");
export const XCircle = persimmon("x-circle", "XCircle");
export const PanelLeft = persimmon("panel-left", "PanelLeft");
export const PanelLeftClose = persimmon("panel-left-close", "PanelLeftClose");
export const Palette = persimmon("palette", "Palette");
export const Plug = persimmon("plug", "Plug");
export const Printer = persimmon("printer", "Printer");
export const RotateCcw = persimmon("undo", "RotateCcw");
export const Undo2 = persimmon("undo", "Undo2");
export const Scissors = persimmon("scissors", "Scissors");
export const Server = persimmon("server", "Server");
export const HardDrive = persimmon("server", "HardDrive");
export const ShieldAlert = persimmon("shield-alert", "ShieldAlert");
export const ShieldOff = persimmon("shield-off", "ShieldOff");
export const ShieldBan = persimmon("shield-off", "ShieldBan");
export const StickyNote = persimmon("note", "StickyNote");
export const Swords = persimmon("swords", "Swords");
export const Table = persimmon("table", "Table");
export const Tag = persimmon("tag", "Tag");
export const Target = persimmon("target", "Target");
export const ThumbsUp = persimmon("thumbs-up", "ThumbsUp");
export const TrendingUp = persimmon("trend-up", "TrendingUp");
export const TrendingDown = persimmon("trend-down", "TrendingDown");
export const Trophy = persimmon("trophy", "Trophy");
export const Frame = persimmon("frame", "Frame");
export const Flame = persimmon("flame", "Flame");
export const Skull = persimmon("skull", "Skull");
export const ShoppingBag = persimmon("shop", "ShoppingBag");
export const Store = persimmon("shop", "Store");
export const SlidersHorizontal = persimmon("sliders", "SlidersHorizontal");
export const Stamp = persimmon("stamp", "Stamp");
export const Lightbulb = persimmon("idea", "Lightbulb");
export const Bug = persimmon("bug", "Bug");
export const UserCheck = persimmon("user-check", "UserCheck");
export const UserMinus = persimmon("user-minus", "UserMinus");
export const UserPlus = persimmon("user-plus", "UserPlus");
export const UserCog = persimmon("user-cog", "UserCog");
export const Wifi = persimmon("wifi", "Wifi");
export const WifiOff = persimmon("wifi-off", "WifiOff");
export const Zap = persimmon("zap", "Zap");
export const ZoomIn = persimmon("zoom-in", "ZoomIn");
export const ZoomOut = persimmon("zoom-out", "ZoomOut");
export const Bold = persimmon("bold", "Bold");
export const Italic = persimmon("italic", "Italic");
export const Underline = persimmon("underline", "Underline");
export const Strikethrough = persimmon("strikethrough", "Strikethrough");
export const Heading1 = persimmon("heading-1", "Heading1");
export const Heading2 = persimmon("heading-2", "Heading2");
export const Heading3 = persimmon("heading-3", "Heading3");
export const List = persimmon("list", "List");
export const ListOrdered = persimmon("list-ordered", "ListOrdered");
export const Quote = persimmon("quote", "Quote");
export const Code = persimmon("code", "Code");
export const Type = persimmon("text", "Type");
export const MoreVertical = persimmon("more", "MoreVertical", 90);
export const GripHorizontal = persimmon("grip", "GripHorizontal", 90);
export const ChevronsRight = persimmon("chevrons-left", "ChevronsRight", 180);
export const ThumbsDown = persimmon("thumbs-up", "ThumbsDown", 180);
export const ArrowUpRight = persimmon("arrow-right", "ArrowUpRight", 315);
export const ArrowDownRight = persimmon("arrow-right", "ArrowDownRight", 45);
export const ArrowDownLeft = persimmon("arrow-right", "ArrowDownLeft", 135);
