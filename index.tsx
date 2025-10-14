import React, { useState, useMemo, useCallback, useEffect, useRef, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';

// --- AVISOS PARA TYPESCRIPT SOBRE BIBLIOTECAS GLOBAIS ---
declare var XLSX: any;
declare var firebase: any; // Adicionado para o Firebase

// --- INICIALIZAÇÃO DO FIREBASE ---
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Evita reinicialização do Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();


// --- DEFINIÇÕES DE TIPOS (Enums) ---
enum ImportStatus {
    OrderPlaced = 'ORDER PLACED',
    ShipmentConfirmed = 'SHIPMENT CONFIRMED',
    DocumentReview = 'DOCUMENT REVIEW',
    InProgress = 'IN TRANSIT',
    AtPort = 'AT THE PORT',
    DiRegistered = 'DI REGISTERED',
    CargoReady = 'CARGO READY',
    CustomsClearance = 'CARGO CLEARED',
    Delivered = 'CARGO DELIVERED',
    Empty = 'VAZIAS',
}

enum PaymentStatus {
    Paid = 'Paid',
    Pending = 'Pending',
    Overdue = 'Overdue',
    Cancelled = 'Cancelled'
}

enum TaskStatus {
    Completed = 'Completed',
    InProgress = 'In Progress',
    Pending = 'Pending'
}

enum FiveW2HStatus {
    Open = 'Open',
    InProgress = 'In Progress',
    Completed = 'Completed'
}


// --- MODELOS DE DADOS (Interfaces) ---
interface ContainerDetail {
    id: string;
    seaportArrivalDate?: string;
    demurrageFreeDays?: number;
}

interface Cost {
    description: string;
    value: number;
    currency: 'USD' | 'BRL' | 'EUR' | 'CNY';
    dueDate?: string;
    status: PaymentStatus;
}

interface Shipment {
  id: string; 
  blAwb: string;
  poSap?: string;
  invoice?: string;
  description?: string;
  typeOfCargo?: string;
  costCenter?: string;
  qtyCarBattery?: number;
  batchChina?: string;
  color?: string;
  exTariff?: string;
  dg?: 'Yes' | 'No' | '';
  uniqueDi?: 'Yes' | 'No' | '';
  liNr?: string;
  statusLi?: string;
  underWater?: 'Yes' | 'No' | '';
  technicianResponsibleChina?: string;
  technicianResponsibleBrazil?: string;
  shipmentType?: string;
  cbm?: number;
  fcl?: number;
  lcl?: number;
  typeContainer?: string;
  incoterm?: string;
  containerUnloaded?: number;
  freightForwarderDestination?: string;
  shipper?: string;
  broker?: string;
  shipowner?: string;
  ieSentToBroker?: string;
  freeTime?: number;
  freeTimeDeadline?: string;
  arrivalVessel?: string;
  voyage?: string;
  bondedWarehouse?: string;
  actualEtd?: string;
  actualEta?: string;
  transitTime?: number;
  storageDeadline?: string;
  cargoPresenceDate?: string;
  diRegistrationDate?: string;
  greenChannelOrDeliveryAuthorizedDate?: string;
  nfIssueDate?: string;
  cargoReady?: string;
  firstTruckDelivery?: string;
  lastTruckDelivery?: string;
  invoicePaymentDate?: string;
  invoiceCurrency?: string;
  invoiceValue?: number;
  freightCurrency?: string;
  freightValue?: number;
  vlmd?: string;
  taxRateCny?: number;
  taxRateUsd?: number;
  cifDi?: string;
  nfValuePerContainer?: number;
  typeOfInspection?: string;
  qtyContainerInspection?: number;
  additionalServices?: string;
  importPlan?: string;
  importLedger?: string;
  draftDi?: string;
  approvedDraftDi?: string;
  ce?: string;
  damageReport?: 'Yes' | 'No' | '';
  di?: string;
  parametrization?: string;
  draftNf?: string;
  approvedDraftNf?: string;
  nfNacionalization?: string;
  status?: ImportStatus;
  observation?: string;
  containers: ContainerDetail[];
  costs: Cost[];
}

interface Claim {
    id: string;
    importBl: string;
    status: 'Resolved' | 'Rejected' | 'Open' | 'In Progress';
    amount: number;
}

interface Task {
    id: string;
    description: string;
    assignedToId: string;
    status: TaskStatus;
    dueDate?: string;
}

type UserRole = 'Admin' | 'COMEX' | 'Broker' | 'Logistics' | 'Finance';

interface User {
    id: string;
    name: string;
    username: string;
    password?: string;
    role: UserRole;
}

interface ExchangeRates {
    date: string;
    time: string;
    usd: { compra: number; venda: number };
    eur: { compra: number; venda: number };
    cny: number;
}

interface FiveW2H {
    id: string;
    what: string;
    why: string;
    who: string;
    where: string;
    when: string;
    how: string;
    howMuch: number;
    currency: 'USD' | 'BRL' | 'EUR' | 'CNY';
    status: FiveW2HStatus;
    relatedTo?: {
        type: 'Import';
        id: string;
        label: string;
    };
}


// --- DADOS INICIAIS (para a primeira vez que a app rodar) ---
const initialExchangeRates: ExchangeRates = {
    date: '2024-07-30', time: '10:00',
    usd: { compra: 5.15, venda: 5.25 },
    eur: { compra: 5.50, venda: 5.60 },
    cny: 0.72
};

const initialUsers: User[] = [
    { id: 'user-1', name: 'Luiz Vieira da Costa Neto', username: 'ADMIN', password: 'Byd@N1', role: 'Admin' },
    { id: 'user-2', name: 'Emanoela Cardoso de O. Pereira Amorim', username: 'emanoelacardoso', password: 'Byd@N1', role: 'Logistics' },
    { id: 'user-3', name: 'Andressa Pinto Silva Barros', username: 'andressapinto', password: 'Byd@N1', role: 'Broker' },
    { id: 'user-4', name: 'Beatriz Regina Rinaldo', username: 'beatrizrinaldo', password: 'Byd@N1', role: 'Broker' },
    { id: 'user-5', name: 'Daniela Guimarães Brito', username: 'danielaguimaraes', password: 'Byd@N1', role: 'Broker' },
    { id: 'user-6', name: 'Marina Barbosa de Quadros', username: 'marinabarbosa', password: 'Byd@N1', role: 'Broker' },
    { id: 'user-7', name: 'Israel Moreira de Oliveira Junior', username: 'israelmoreira', password: 'Byd@N1', role: 'Broker' },
    { id: 'user-8', name: 'Caio Blanco Carreira', username: 'caioblanco', password: 'Byd@N1', role: 'COMEX' },
    { id: 'user-9', name: 'Giani Oriente Oliveira', username: 'gianioriente', password: 'Byd@N1', role: 'COMEX' },
    { id: 'user-10', name: 'Italo de Araújo Wanderley Romeiro', username: 'italoaraujo', password: 'Byd@N1', role: 'COMEX' },
    { id: 'user-11', name: 'Taine de Melo Carneiro Oliveira', username: 'tainedemelo', password: 'Byd@N1', role: 'COMEX' },
    { id: 'user-12', name: 'Fabio Levi da Cruz Silva', username: 'fabiolevi', password: 'Byd@N1', role: 'Logistics' },
    { id: 'user-13', name: 'Rebeca Magalhães Just da Rocha Pita', username: 'rebecamagalhaes', password: 'Byd@N1', role: 'Logistics' },
    { id: 'user-14', name: 'Cindy Mileni Álvares Nascimento', username: 'cindymileni', password: 'Byd@N1', role: 'Logistics' },
    { id: 'user-15', name: 'Bruno Borges Coelho', username: 'brunoborges', password: 'Byd@N1', role: 'Logistics' },
];


// --- ÍCONES ---
// ... (Seus componentes de ícones estão aqui, sem alterações)
const DashboardIcon = () => (<svg className="nav-icon" viewBox="0 0 24 24"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"></path></svg>);
const ImportsIcon = () => (<svg className="nav-icon" viewBox="0 0 24 24"><path d="M20 18v-2h-3v2h3zm-3-4h3v-2h-3v2zm3-4h-3v2h3V6zm-5 2h2v2h-2V8zm-8 4h3v-2H7v2zm3-4H7v2h3V8zm0-4H7v2h3V4zm10 8h-3v2h3v-2zm-3-4h3V8h-3v2zM5 22h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2zM5 4h14v16H5V4z"></path></svg>);
const LogisticsIcon = () => (<svg className="nav-icon" viewBox="0 0 24 24"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm13.5-8.5 1.96 2.5H17V9.5h2.5zM18 18c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"></path></svg>);
const TeamIcon = () => (<svg className="nav-icon" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"></path></svg>);
const AdminIcon = () => (<svg className="nav-icon" viewBox="0 0 24 24"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49 1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49.42l.38-2.65c.61-.25 1.17-.59-1.69.98l2.49 1c.23.09.49 0-.61.22l2-3.46c.12-.22.07-.49-.12.64l-2.22-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"></path></svg>);
const FiveW2HIcon = () => (<svg className="nav-icon" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-2 14h-2v-2h2v2zm0-4h-2V9h2v3zm-1-5c-.55 0-1-.45-1-1V3.5L18.5 9H13z"></path></svg>);
const BackIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>);
const UploadIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="upload-icon"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>);
const CloseIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>);
const EditIcon = () => (<svg viewBox="0 0 24 24" fill="currentColor" style={{width: "1em", height: "1em"}}><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"></path></svg>);
const SaveIcon = () => (<svg viewBox="0 0 24 24" fill="currentColor" style={{width: "1em", height: "1em"}}><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"></path></svg>);
const CancelIcon = () => (<svg viewBox="0 0 24 24" fill="currentColor" style={{width: "1em", height: "1em"}}><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"></path></svg>);
const ContainerIcon = () => (<svg className="header-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M20 16h2v-4h-2v4zm-3-4H7V4h10v8zm3-6H4c-1.1 0-2 .9-2 2v10h2c0 1.66 1.34 3 3 3s3-1.34 3-3h4c0 1.66 1.34 3 3 3s3-1.34 3-3h2V8c0-1.1-.9-2-2-2z"></path></svg>);
const CalendarIcon = () => (<svg className="header-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"></path></svg>);
const ReceiptIcon = () => (<svg className="header-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M18 17H6v-2h12v2zm0-4H6v-2h12v2zm0-4H6V7h12v2zM3 22l1.5-1.5L6 22l1.5-1.5L9 22l1.5-1.5L12 22l1.5-1.5L15 22l1.5-1.5L18 22l1.5-1.5L21 22V2l-1.5 1.5L18 2l-1.5 1.5L15 2l-1.5 1.5L12 2l-1.5 1.5L9 2 7.5 3.5 6 2 4.5 3.5 3 2v20z"></path></svg>);
const ReportIcon = () => (<svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M18 17H6v-2h12v2zm0-4H6v-2h12v2zm0-4H6V7h12v2zM3 22l1.5-1.5L6 22l1.5-1.5L9 22l1.5-1.5L12 22l1.5-1.5L15 22l1.5-1.5L18 22l1.5-1.5L21 22V2l-1.5 1.5L18 2l-1.5 1.5L15 2l-1.5 1.5L12 2l-1.5 1.5L9 2 7.5 3.5 6 2 4.5 3.5 3 2v20z"></path></svg>);
const StatusOnVesselIcon = () => <svg className="status-icon" viewBox="0 0 24 24"><path d="M20 21c-1.39 0-2.78-.47-4-1.32-1.22-.85-2.58-1.32-4-1.32s-2.78.47-4 1.32C6.78 20.53 5.39 21 4 21H2v-2l2-3 2 3 2-3 2 3 2-3 2 3 2-3 2 3v2h-2zM3.95 12H4v2h-.05l-.35-1 .35-1zM20 4H4v6h16V4z"></path></svg>;
const StatusAtPortIcon = () => <svg className="status-icon" viewBox="0 0 24 24"><path d="M20 18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2H1c-.55 0-1 .45-1 1s.45 1 1 1h22c.55 0 1-.45 1-1s-.45-1-1-1h-3zM5 13c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm3 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"></path></svg>;
const StatusInWarehouseIcon = () => <svg className="status-icon" viewBox="0 0 24 24"><path d="M12 3L2 12h3v8h14v-8h3L12 3zm2 15h-4v-4h4v4z"></path></svg>;
const StatusDeliveredIcon = () => <svg className="status-icon" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"></path></svg>;
const StatusReturnedIcon = () => <svg className="status-icon" viewBox="0 0 24 24"><path d="M19 7v4H5.83l3.58-3.59L8 6l-6 6 6 6 1.41-1.41L5.83 13H21V7h-2z"></path></svg>;
const SparklesIcon = () => <svg className="header-icon" viewBox="0 0 24 24"><path d="M19 9.5l-2.7-2.7L19 4l2.7 2.8L19 9.5zm-5 5L11.3 11.8 14 9l2.7 2.8L14 14.5zm-5 5L6.3 16.8 9 14l2.7 2.8L9 19.5zM5 9.5L2.3 6.8 5 4l2.7 2.8L5 9.5zM12 22l-3-3 3-3 3 3-3 3z"></path></svg>;
const LinkIcon = () => <svg viewBox="0 0 20 20" fill="currentColor" style={{width: "1em", height: "1em"}}><path d="M12.232 4.232a2.5 2.5 0 013.536 3.536l-1.225 1.224a.75.75 0 001.061 1.06l1.224-1.224a4 4 0 00-5.656-5.656l-3 3a4 4 0 00.225 5.865.75.75 0 00.977-1.138 2.5 2.5 0 01-.142-3.665l3-3z"></path><path d="M8.603 14.397a2.5 2.5 0 01-3.536-3.536l1.225-1.224a.75.75 0 00-1.061-1.06l-1.224 1.224a4 4 0 005.656 5.656l3-3a4 4 0 00-.225-5.865.75.75 0 00-.977 1.138 2.5 2.5 0 01.142 3.665l-3 3z"></path></svg>;
const LogoutIcon = () => (<svg className="nav-icon" viewBox="0 0 24 24"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"></path></svg>);
const KeyIcon = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.65 10A5.5 5.5 0 1 0 5.5 4.5A5.5 5.5 0 0 0 11 10h1.65l3.54 3.54-1.41 1.41-1-1v3.55a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1V14h-1v4a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-1.58l-2.72-2.72a.5.5 0 0 1 0-.7l.7-.7.71.7.71-.71.7-.7.71.71.71-.7.7.71.71-.71 3.18-3.18zM5.5 8a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"></path></svg>;
const TrashIcon = () => (<svg viewBox="0 0 24 24" fill="currentColor" style={{width: "1em", height: "1em"}}><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path></svg>);
const ExportIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m-3-3h6M3.75 6A2.25 2.25 0 016 3.75h12A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6z" /></svg>;
const ChevronDownIcon = () => (<svg viewBox="0 0 20 20" fill="currentColor" style={{width: "1em", height: "1em", transition: "transform 0.2s"}}><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>);
const DollarSignIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="kpi-icon"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>;
const TruckIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="kpi-icon"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>;
const CheckCircleIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="kpi-icon"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>;
const AlertTriangleIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="kpi-icon"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>;
const ListChecksIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="kpi-icon"><path d="M16 14l-4-4-4 4"></path><path d="M12 20V10"></path><path d="M3 10h18"></path><path d="M3 4h18"></path></svg>; // Placeholder
const LayersIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="kpi-icon"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>;
const ClockIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="kpi-icon"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>;
const FileWarningIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="kpi-icon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="12" y1="9" x2="12.01" y2="9"></line></svg>;
const AlertCircleIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>;
const Loader2Icon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>;
const InfoIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="log-icon"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>;
const SearchIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="log-icon"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>;
const WandIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="header-icon"><path d="M15 4V2m0 14v-2m-7.5-1.5L6 13m0 0L4.5 14.5M20 9.5h2M2 9.5h2M19.5 14.5L21 13m0 0l-1.5-1.5M4.5 4.5L6 6m0 0l1.5 1.5M12 12l1-1 2 2-1 1-2-2zm-2 2l-1 1-2-2 1-1 2 2z"></path></svg>;
const UserIcon = () => (<svg viewBox="0 0 24 24" fill="currentColor" className="nav-icon"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path></svg>);


// --- FUNÇÕES AUXILIARES (sem alterações) ---
// ... (Suas funções auxiliares estão aqui, sem alterações)
const getStatusPillClass = (status: Shipment['status']) => {
    const statusMap = {
      [ImportStatus.Delivered]: 'status-cargo-delivered',
      [ImportStatus.CustomsClearance]: 'status-cargo-cleared',
      [ImportStatus.InProgress]: 'status-in-transit',
      [ImportStatus.AtPort]: 'status-at-the-port',
      [ImportStatus.ShipmentConfirmed]: 'status-purple',
      [ImportStatus.OrderPlaced]: 'status-grey',
      [ImportStatus.DocumentReview]: 'status-document-review',
      [ImportStatus.DiRegistered]: 'status-di-registered',
      [ImportStatus.CargoReady]: 'status-cargo-ready',
      [ImportStatus.Empty]: 'status-empty',
    };
    return statusMap[status!] || '';
};

const get5W2HStatusPillClass = (status: FiveW2HStatus) => {
    const statusMap = {
        [FiveW2HStatus.Completed]: 'status-green',
        [FiveW2HStatus.InProgress]: 'status-blue',
        [FiveW2HStatus.Open]: 'status-orange',
    };
    return statusMap[status] || '';
}

const uuidv4 = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

const isPast = (date: Date) => new Date() > date;
const differenceInDays = (dateLeft: Date, dateRight: Date) => {
    const diffTime = dateLeft.getTime() - dateRight.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};
const addDays = (date: Date, amount: number) => {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + amount);
    return newDate;
};
const format = (date: Date, formatStr: string) => {
    if (formatStr === 'HH:mm') {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }
    if (formatStr === 'PPP') {
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    }
    return date.toISOString();
};

const formatCurrency = (value: number | undefined | null, currency = 'BRL') => {
    if (value === undefined || value === null || isNaN(value)) {
        return '-';
    }
    return value.toLocaleString('pt-BR', { style: 'currency', currency: currency });
};

const formatNumber = (value: number | undefined | null, options?: Intl.NumberFormatOptions) => {
    if (value === undefined || value === null || isNaN(value)) {
        return '-';
    }
    return value.toLocaleString('en-US', options);
};

const toTitleCase = (str: string | undefined | null): string => {
    if (!str) return '';
    const trimmed = str.trim().toUpperCase();
    if (trimmed.length === 0 || trimmed === 'PARAMETRIZATION') return '';
    
    if (['GREEN', 'YELLOW', 'RED'].includes(trimmed)) return trimmed.charAt(0) + trimmed.slice(1).toLowerCase();

    return trimmed
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
};

const toDisplayDate = (isoDate: string | undefined | null): string => {
    if (!isoDate) return '';
    const datePart = isoDate.split('T')[0].split(' ')[0];
    const parts = datePart.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
        const [y, m, d] = parts;
        return `${d}/${m}/${y}`;
    }
    return isoDate;
};

const fromDisplayDate = (displayDate: string): string => {
    const [d, m, y] = displayDate.split('/');
    return `${y}-${m}-${d}`;
};

const parseDate = (dateStr: string | undefined | null): Date | null => {
    if (!dateStr) return null;
    const datePart = dateStr.split('T')[0].split(' ')[0];

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(datePart)) {
        const [d, m, y] = datePart.split('/');
        const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        if (date.getFullYear() === parseInt(y) && date.getMonth() === parseInt(m) - 1 && date.getDate() === parseInt(d)) {
            return date;
        }
        return null;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        const [y, m, d] = datePart.split('-');
        const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        if (date.getFullYear() === parseInt(y) && date.getMonth() === parseInt(m) - 1 && date.getDate() === parseInt(d)) {
            return date;
        }
        return null;
    }
    
    return null;
};

const calculateStorageDeadline = (incoterm?: string, warehouse?: string, etaStr?: string): string => {
    const etaDate = parseDate(etaStr);
    if (!etaDate || !incoterm || !warehouse) return '';

    let daysToAdd: number | null = null;
    const incotermUpper = incoterm.toUpperCase();

    if (incotermUpper === 'DAP') {
        if (['Intermarítima', 'TPC', 'CLIA Empório'].includes(warehouse)) {
            daysToAdd = 15;
        } else if (warehouse === 'Teca') {
            daysToAdd = 2;
        }
    } else if (['FOB', 'CIF', 'CFR', 'CPT'].includes(incotermUpper)) {
        if (warehouse === 'Intermarítima') {
            daysToAdd = 10;
        } else if (['TPC', 'CLIA Empório'].includes(warehouse)) {
            daysToAdd = 30;
        } else if (warehouse === 'Teca') {
            daysToAdd = 2;
        }
    }

    if (daysToAdd !== null) {
        const deadlineDate = addDays(etaDate, daysToAdd);
        const y = deadlineDate.getFullYear();
        const m = (deadlineDate.getMonth() + 1).toString().padStart(2, '0');
        const d = deadlineDate.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    
    return '';
};

const convertToUSD = (value: number, currency: string, rates: ExchangeRates | null): number => {
    if (!rates || !currency) return 0;
    const upperCurrency = currency.toUpperCase();
    
    if (upperCurrency === 'USD') return value;
    if (upperCurrency === 'BRL' && rates.usd.venda) return value / rates.usd.venda;
    if (upperCurrency === 'EUR' && rates.eur.venda && rates.usd.venda) return (value * rates.eur.venda) / rates.usd.venda;
    if (upperCurrency === 'CNY' && rates.cny && rates.usd.venda) return (value * rates.cny) / rates.usd.venda;
    
    return 0;
};

const normalizeHeader = (header: string) => {
    if (!header) return '';
    return header.toLowerCase().replace(/[\s/._-]/g, '').replace('ç', 'c').replace('ã', 'a');
};

const orderedShipmentColumns: { header: string, key: keyof Shipment }[] = [
    { header: 'SHIPPER', key: 'shipper' },
    { header: 'PO SAP', key: 'poSap' },
    { header: 'INVOICE', key: 'invoice' },
    { header: 'BL/AWB', key: 'blAwb' },
    { header: 'DESCRIPTION', key: 'description' },
    { header: 'TYPE OF CARGO', key: 'typeOfCargo' },
    { header: 'COST CENTER', key: 'costCenter' },
    { header: 'QTY CAR / BATTERY', key: 'qtyCarBattery' },
    { header: 'BATCH CHINA', key: 'batchChina' },
    { header: 'COLOR', key: 'color' },
    { header: 'EX TARIFF', key: 'exTariff' },
    { header: 'UNIQUE DI', key: 'uniqueDi' },
    { header: 'LI NR.', key: 'liNr' },
    { header: 'STATUS LI', key: 'statusLi' },
    { header: 'DG', key: 'dg' },
    { header: 'UNDER WATER', key: 'underWater' },
    { header: 'TECHNICIAN RESPONSIBLE - CHINA TEAM', key: 'technicianResponsibleChina' },
    { header: 'TECHNICIAN RESPONSIBLE BRAZIL', key: 'technicianResponsibleBrazil' },
    { header: 'SHIPMENT TYPE', key: 'shipmentType' },
    { header: 'CBM', key: 'cbm' },
    { header: 'FCL', key: 'fcl' },
    { header: 'LCL', key: 'lcl' },
    { header: 'TYPE CONTAINER', key: 'typeContainer' },
    { header: 'INCOTERM', key: 'incoterm' },
    { header: 'CONTAINER UNLOADED', key: 'containerUnloaded' },
    { header: 'FREIGHT FORWADER DESTINATION', key: 'freightForwarderDestination' },
    { header: 'BROKER', key: 'broker' },
    { header: 'IE SENT TO BROKER', key: 'ieSentToBroker' },
    { header: 'SHIPOWNER', key: 'shipowner' },
    { header: 'FREE TIME', key: 'freeTime' },
    { header: 'FREE TIME DEADLINE', key: 'freeTimeDeadline' },
    { header: 'ARRIVAL VESSEL', key: 'arrivalVessel' },
    { header: 'VOYAGE', key: 'voyage' },
    { header: 'BONDED WAREHOUSE', key: 'bondedWarehouse' },
    { header: 'INVOICE CURRENCY', key: 'invoiceCurrency' },
    { header: 'INVOICE VALUE', key: 'invoiceValue' },
    { header: 'FREIGHT CURRENCY', key: 'freightCurrency' },
    { header: 'FREIGHT VALUE', key: 'freightValue' },
    { header: 'TYPE OF INSPECTION', key: 'typeOfInspection' },
    { header: 'QTY CONTAINER INSPECTION', key: 'qtyContainerInspection' },
    { header: 'ADDITIONAL SERVICES', key: 'additionalServices' },
    { header: 'IMPORT PLAN', key: 'importPlan' },
    { header: 'IMPORT LEDGER', key: 'importLedger' },
    { header: 'DRAFT DI', key: 'draftDi' },
    { header: 'APPROVED DRAFT DI', key: 'approvedDraftDi' },
    { header: 'ACTUAL ETD', key: 'actualEtd' },
    { header: 'ACTUAL ETA', key: 'actualEta' },
    { header: 'TRANSIT TIME', key: 'transitTime' },
    { header: 'STORAGE DEADLINE', key: 'storageDeadline' },
    { header: 'CE', key: 'ce' },
    { header: 'CARGO PRESENCE DATE', key: 'cargoPresenceDate' },
    { header: 'DAMAGE REPORT', key: 'damageReport' },
    { header: 'DI', key: 'di' },
    { header: 'DI REGISTRATION DATE', key: 'diRegistrationDate' },
    { header: 'PARAMETRIZATION', key: 'parametrization' },
    { header: 'GREEN CHANNEL OR DELIVERY AUTHORIZED DATE', key: 'greenChannelOrDeliveryAuthorizedDate' },
    { header: 'VLMD', key: 'vlmd' },
    { header: 'TAX RATE CNY', key: 'taxRateCny' },
    { header: 'TAX RATE USD', key: 'taxRateUsd' },
    { header: 'CIF DI', key: 'cifDi' },
    { header: 'DRAFT NF', key: 'draftNf' },
    { header: 'APPROVED DRAFT NF', key: 'approvedDraftNf' },
    { header: 'NF NACIONALIZATION', key: 'nfNacionalization' },
    { header: 'NF ISSUE DATE', key: 'nfIssueDate' },
    { header: 'NF VALUE PER CONTAINER', key: 'nfValuePerContainer' },
    { header: 'CARGO READY', key: 'cargoReady' },
    { header: 'FIRST TRUCK DELIVERY', key: 'firstTruckDelivery' },
    { header: 'LAST TRUCK DELIVERY', key: 'lastTruckDelivery' },
    { header: 'INVOICE PAYMENT DATE', key: 'invoicePaymentDate' },
    { header: 'STATUS', key: 'status' },
    { header: 'OBSERVATION', key: 'observation' },
];


const exportAllToXLSX = (shipments: Shipment[], fileName: string = 'fup_report.xlsx') => {
    // ... (função sem alterações)
    if (shipments.length === 0) {
        alert('No data to export.');
        return;
    }

    const dataToExport = shipments.map(row => {
        const newRow: { [key: string]: any } = {};
        orderedShipmentColumns.forEach(col => {
            const value = row[col.key];
            newRow[col.header] = value === null || value === undefined ? '' : value;
        });
        return newRow;
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport, {
        header: orderedShipmentColumns.map(c => c.header)
    });

    const colWidths = orderedShipmentColumns.map(col => {
        const headerWidth = col.header.length;
        const dataWidths = dataToExport.map(row => String(row[col.header] || '').length);
        return { wch: Math.max(headerWidth, ...dataWidths) + 2 };
    });
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'FUP Report');

    XLSX.writeFile(wb, fileName);
};

const exportFUP = (shipment: Shipment) => {
    // ... (função sem alterações)
    let fupContent = `FOLLOW-UP - IMPORT PROCESS: ${shipment.blAwb}\n\n`;
    
    orderedShipmentColumns.forEach(col => {
        const value = shipment[col.key];
        fupContent += `${col.header}: ${value === null || value === undefined ? 'N/A' : value}\n`;
    });

    const blob = new Blob([fupContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `FUP_${shipment.blAwb}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};


// --- COMPONENTES (Sidebar, BarChart, etc.) ---
// ... (todos os seus componentes, como Sidebar, BarChart, etc., estão aqui, sem alterações)
const Sidebar = ({ onNavigate, activeView, onLogout, loggedInUser }: { onNavigate: (view: string) => void, activeView: string, onLogout: () => void, loggedInUser: User | null }) => {
    const navItems = [
      { label: 'Dashboard', icon: <DashboardIcon /> },
      { label: 'Imports', icon: <ImportsIcon /> },
      { label: 'Relatório FUP', icon: <ReportIcon /> },
      { label: 'Logistics', icon: <LogisticsIcon /> },
      { label: '5W2H Plan', icon: <FiveW2HIcon /> },
      { label: 'Team', icon: <TeamIcon /> },
      { label: 'Admin', icon: <AdminIcon /> },
    ];
   
    return (
      <nav className="sidebar" aria-label="Main Navigation">
        <div>
          <div className="sidebar-header">Navigator</div>
          <ul className="nav-links">
            {navItems.map((item) => (
              <li key={item.label}>
                <a href="#" className={`nav-link ${activeView.startsWith(item.label.toLowerCase().replace(/ /g, '').replace('ó','o')) ? 'active' : ''}`} role="button" aria-current={activeView.startsWith(item.label.toLowerCase()) ? "page" : undefined} onClick={(e) => { e.preventDefault(); onNavigate(item.label); }}>
                  {item.icon}
                  <span className="nav-label">{item.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="sidebar-footer">
         {loggedInUser && (
            <div className="user-info">
                <UserIcon />
                <div className="user-details">
                    <span className="user-name">{loggedInUser.name}</span>
                    <span className="user-role">{loggedInUser.role}</span>
                </div>
            </div>
         )}
        <a href="#" className="nav-link logout-btn" role="button" onClick={(e) => { e.preventDefault(); onLogout(); }}>
          <LogoutIcon />
          <span className="nav-label">Logout</span>
        </a>
      </div>
      </nav>
    );
};

const BarChart = ({ data, onBarClick }: { data: any, onBarClick?: (label: string) => void }) => {
    // ... (componente sem alterações)
    const maxValue = Math.max(...data.datasets[0].data, 1);
    return (
        <div className="bar-chart-placeholder">
            <div className="chart-title">Imports by Status</div>
            <div className="chart-body">
                {data.labels.map((label: string, index: number) => (
                    <button 
                        key={label} 
                        className="bar-item" 
                        onClick={() => onBarClick && onBarClick(label)} 
                        disabled={!onBarClick || data.datasets[0].data[index] === 0}
                        aria-label={`Filter by status: ${label}, Count: ${data.datasets[0].data[index]}`}
                    >
                        <div className="bar-label">{label}</div>
                        <div className="bar-wrapper">
                            <div 
                                className="bar" 
                                style={{ 
                                    width: `${(data.datasets[0].data[index] / maxValue) * 100}%`,
                                    backgroundColor: data.datasets[0].backgroundColor[index] || '#ccc'
                                }}
                            >
                                <span className="bar-value">{data.datasets[0].data[index]}</span>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};

// ... (todos os outros componentes como DashboardPage, ImportListPage, etc. continuam aqui sem alterações)
// (Incluindo a correção na LogisticsPage que fizemos antes)
const LogisticsPage = ({ shipments, setShipments }: { shipments: Shipment[], setShipments: (shipments: Shipment[]) => void }) => {
    return (
        <div className="logistics-page">
            <header>
                <h1>Logistics Management</h1>
            </header>
            {/* <VesselUpdateService shipments={shipments} setShipments={setShipments} /> */}
        </div>
    );
};

// ... (Restante dos seus componentes...)


// --- COMPONENTE PRINCIPAL: App ---
const App = () => {
    // --- ESTADOS GLOBAIS DA APLICAÇÃO ---
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [claims, setClaims] = useState<Claim[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [exchangeRates, setExchangeRates] = useState<ExchangeRates | null>(null);
    const [fiveW2HData, setFiveW2HData] = useState<FiveW2H[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // NOVO: Estado de segurança para garantir que o Firebase carregou antes de salvar
    const [isFirebaseLoaded, setIsFirebaseLoaded] = useState(false);

    // --- ESTADO DE AUTENTICAÇÃO ---
    const [loggedInUser, setLoggedInUser] = useState<User | null>(null);
    const [loginError, setLoginError] = useState('');
    
    // --- ESTADO DE NAVEGAÇÃO ---
    const [currentView, setCurrentView] = useState('dashboard');
    const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
    const [initialImportFilter, setInitialImportFilter] = useState<{ type: string, value: string } | null>(null);

    // --- ESTADO DO MODAL DE CONFIRMAÇÃO ---
    const [shipmentToDeleteId, setShipmentToDeleteId] = useState<string | null>(null);

    // MODIFICADO: Efeito para carregar dados do Firebase na inicialização
    useEffect(() => {
        const unsubscribe = db.collection('navigator_erp').doc('live_data').onSnapshot((doc: any) => {
            if (doc.exists) {
                const data = doc.data();
                console.log("Dados recebidos do Firebase:", data);
                
                // Re-hidrata os objetos Date que o Firebase armazena como Timestamps
                const rehydratedShipments = (data.shipments || []).map((s: any) => ({
                    ...s,
                    // Adicione aqui todos os campos de data do seu 'shipment'
                    ieSentToBroker: s.ieSentToBroker || undefined,
                    freeTimeDeadline: s.freeTimeDeadline || undefined,
                    actualEtd: s.actualEtd || undefined,
                    actualEta: s.actualEta || undefined,
                    // etc...
                }));

                setShipments(rehydratedShipments);
                setUsers(data.users || initialUsers);
                setClaims(data.claims || []);
                setTasks(data.tasks || []);
                setExchangeRates(data.exchangeRates || initialExchangeRates);
                setFiveW2HData(data.fiveW2HData || []);

            } else {
                console.log("Nenhum dado encontrado no Firebase, iniciando com dados locais.");
                // Se o documento não existe, usamos os dados mock e salvamos para criar
                setShipments([]);
                setUsers(initialUsers);
                setClaims([]);
                setTasks([]);
                setExchangeRates(initialExchangeRates);
                setFiveW2HData([]);
            }
            setIsLoading(false);
            setIsFirebaseLoaded(true); // NOVO: Marca que o carregamento inicial foi concluído
        }, (error: any) => {
            console.error("Erro ao ouvir o Firebase:", error);
            setIsLoading(false);
            setIsFirebaseLoaded(true); // NOVO: Marca como concluído mesmo em caso de erro para não travar
        });

        // Limpa o listener quando o componente é desmontado
        return () => unsubscribe();
    }, []);

    // MODIFICADO: Efeito para salvar o estado no Firebase sempre que ele mudar
    useEffect(() => {
        // MODIFICADO: Trava de segurança. SÓ SALVA DEPOIS QUE O FIREBASE CARREGOU PELA PRIMEIRA VEZ.
        if (!isFirebaseLoaded) {
            return;
        }

        const allData = {
            shipments,
            users,
            claims,
            tasks,
            exchangeRates,
            fiveW2HData,
        };

        // Debounce para evitar muitas escritas seguidas
        const timer = setTimeout(() => {
            console.log("Salvando estado no Firebase...", allData);
            db.collection('navigator_erp').doc('live_data').set(allData)
              .catch((error: any) => console.error("Erro ao salvar no Firebase:", error));
        }, 1000); // Salva 1 segundo após a última alteração

        return () => clearTimeout(timer);

    }, [shipments, users, claims, tasks, exchangeRates, fiveW2HData, isFirebaseLoaded]); // MODIFICADO: Adiciona isFirebaseLoaded à lista de dependências

    // ... (Todo o resto do seu componente App, handlers e renderView continuam aqui, sem alterações)
    // --- HANDLERS (lógica de navegação e ações) ---
    const handleLogin = (username: string, pass: string) => {
        const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === pass);
        if (user) {
            setLoggedInUser(user);
            setLoginError('');
        } else {
            setLoginError('Incorrect username or password. Please try again.');
        }
    };
    
    const handleLogout = () => {
        setLoggedInUser(null);
        setCurrentView('dashboard');
    };
    
    const handleNavigate = (viewLabel: string, filter?: { type: string, value: string }) => {
        const view = viewLabel.toLowerCase().replace(/ /g, '').replace('ó', 'o');
        setSelectedShipmentId(null);
        if (filter) {
            setInitialImportFilter(filter);
            setCurrentView('imports');
        } else {
            setCurrentView(view);
        }
    };
    
    const handleClearInitialFilter = useCallback(() => {
        setInitialImportFilter(null);
    }, []);
   
    const handleSelectShipment = (id: string) => {
         setSelectedShipmentId(id);
         setCurrentView('imports/detail');
    };
    
    const handleEditShipment = (id: string) => {
         setSelectedShipmentId(id);
         setCurrentView('imports/edit');
    };
    
    const handleNewShipment = () => {
         setSelectedShipmentId(null);
         setCurrentView('imports/new');
    };
   
    const handleBackToList = () => {
         setSelectedShipmentId(null);
         setCurrentView('imports');
    };
   
    // --- AÇÕES DE DADOS (agora só atualizam o estado local, o useEffect cuida de salvar) ---
    const addShipment = (newShipmentData: Shipment) => {
         const newShipment = { 
             ...newShipmentData, 
             id: uuidv4(),
             blAwb: newShipmentData.blAwb || 'TBC'
         };
         setShipments(prev => [newShipment, ...prev]);
         handleBackToList();
    };
   
    const updateShipment = (updatedShipment: Shipment) => {
         setShipments(prev => prev.map(s => s.id === updatedShipment.id ? updatedShipment : s));
         handleBackToList();
    };
   
     const initiateDeleteShipment = (id: string) => {
         if (loggedInUser?.role !== 'Admin') {
             alert('You do not have permission to delete shipments.');
             return;
         }
         setShipmentToDeleteId(id);
     };
   
     const confirmDeleteShipment = () => {
         if (!shipmentToDeleteId) return;
         setShipments(prev => prev.filter(s => s.id !== shipmentToDeleteId));
         setShipmentToDeleteId(null);
     };
   
     const cancelDeleteShipment = () => {
         setShipmentToDeleteId(null);
     };
   
    const handleBulkImport = (newOrUpdatedShipments: Shipment[]) => {
         setShipments(prevShipments => {
             const shipmentMap = new Map(prevShipments.map(s => [s.blAwb, s]));
             
             newOrUpdatedShipments.forEach(newShipment => {
                 shipmentMap.set(newShipment.blAwb, newShipment);
             });
             
             return Array.from(shipmentMap.values());
         });
    };
   
    const saveFiveW2H = (item: FiveW2H) => {
        if (item.id) {
            setFiveW2HData(prev => prev.map(d => d.id === item.id ? item : d));
        } else {
            setFiveW2HData(prev => [{ ...item, id: uuidv4() }, ...prev]);
        }
    };
   
    const deleteFiveW2H = (id: string) => {
        if (window.confirm('Are you sure you want to delete this action item?')) {
            setFiveW2HData(prev => prev.filter(d => d.id !== id));
        }
    };
    
    const handleSaveUser = (user: User) => {
       if (user.id) { // Update
           setUsers(prev => prev.map(u => {
               if (u.id === user.id) {
                   const newPassword = user.password ? user.password : u.password;
                   const updatedUser = { ...user, password: newPassword };
                   if (loggedInUser?.id === user.id) {
                       setLoggedInUser(updatedUser);
                   }
                   return updatedUser;
               }
               return u;
           }));
       } else { // Create
           setUsers(prev => [{ ...user, id: uuidv4() }, ...prev]);
       }
    };
    
    const handleChangePassword = (newPassword: string) => {
       if (loggedInUser) {
           const updatedUser = { ...loggedInUser, password: newPassword };
           setLoggedInUser(updatedUser);
           setUsers(prevUsers => prevUsers.map(u => u.id === loggedInUser.id ? updatedUser : u));
       }
    };
   
    const handleDeleteUser = (id: string) => {
       const userToDelete = users.find(u => u.id === id);
       if (!userToDelete) return;
   
       if (loggedInUser?.id === id) {
           alert("You cannot delete your own account.");
           return;
       }
   
       if (userToDelete.role === 'Admin') {
           const adminCount = users.filter(u => u.role === 'Admin').length;
           if (adminCount <= 1) {
               alert("You cannot delete the last admin user.");
               return;
           }
       }
   
       if (window.confirm(`Are you sure you want to delete the user "${userToDelete.name}"? This action cannot be undone.`)) {
           setUsers(prevUsers => prevUsers.filter(u => u.id !== id));
       }
    };
   
    // ... (renderView function e o resto da App)
    const renderView = () => {
        const viewParts = currentView.split('/');
        const baseView = viewParts[0];
       
        switch (baseView) {
            case 'dashboard':
                return (
                    <DashboardPage 
                        imports={shipments} 
                        claims={claims} 
                        tasks={tasks}
                        exchangeRates={exchangeRates}
                        setExchangeRates={setExchangeRates}
                        currentUser={loggedInUser}
                        onNavigate={handleNavigate}
                    />
                );
            case 'imports':
                if (viewParts[1] === 'new') return <ImportFormPage onSave={addShipment} onCancel={handleBackToList} />;
                if (viewParts[1] === 'edit' && selectedShipmentId) {
                    const imp = shipments.find(s => s.id === selectedShipmentId);
                    return imp ? <ImportFormPage onSave={updateShipment} onCancel={handleBackToList} existingImport={imp} /> : <ImportListPage imports={shipments} onSelect={handleSelectShipment} onNew={handleNewShipment} onUpdate={updateShipment} onDelete={initiateDeleteShipment} onBulkImport={handleBulkImport} initialFilter={initialImportFilter} onClearInitialFilter={handleClearInitialFilter} />;
                }
                if (viewParts[1] === 'detail' && selectedShipmentId) {
                    const imp = shipments.find(s => s.id === selectedShipmentId);
                    return imp ? <ImportDetailPage importProcess={imp} onBack={handleBackToList} onEdit={() => handleEditShipment(selectedShipmentId)} /> : <ImportListPage imports={shipments} onSelect={handleSelectShipment} onNew={handleNewShipment} onUpdate={updateShipment} onDelete={initiateDeleteShipment} onBulkImport={handleBulkImport} initialFilter={initialImportFilter} onClearInitialFilter={handleClearInitialFilter} />;
                }
                return <ImportListPage imports={shipments} onSelect={handleSelectShipment} onNew={handleNewShipment} onUpdate={updateShipment} onDelete={initiateDeleteShipment} onBulkImport={handleBulkImport} initialFilter={initialImportFilter} onClearInitialFilter={handleClearInitialFilter} />;
            case 'relatoriofup':
                return <FUPReportPage shipments={shipments} />;
            case 'logistics':
                return <LogisticsPage shipments={shipments} setShipments={setShipments} />;
            case '5w2hplan':
                return <FiveW2HPage data={fiveW2HData} onSave={saveFiveW2H} onDelete={deleteFiveW2H} allImports={shipments} allUsers={users} />;
            case 'team':
                return <TeamPage users={users} onSave={handleSaveUser} onDelete={handleDeleteUser} />;
            case 'admin':
                return <AdminPage user={loggedInUser!} onPasswordChange={handleChangePassword} />;
            default:
                 return <DashboardPage imports={shipments} claims={claims} tasks={tasks} exchangeRates={exchangeRates} setExchangeRates={setExchangeRates} currentUser={loggedInUser} onNavigate={handleNavigate} />;
        }
    };
   
    if (isLoading) {
        return (
            <div className="loading-screen">
                <Loader2Icon />
                <p>Loading Navigator ERP...</p>
            </div>
        );
    }

    if (!loggedInUser) {
        return <LoginScreen onLogin={handleLogin} error={loginError} />;
    }
   
    return (
        <div className="app-container">
            <Sidebar onNavigate={handleNavigate} activeView={currentView} onLogout={handleLogout} loggedInUser={loggedInUser}/>
            <main className="main-content">
                {renderView()}
            </main>
            {shipmentToDeleteId && (
                 <ConfirmationModal
                     title="Confirm Deletion"
                     message="Are you sure you want to delete this BL/process? This action cannot be undone."
                     onConfirm={confirmDeleteShipment}
                     onCancel={cancelDeleteShipment}
                     confirmText="Yes, Delete"
                     cancelText="Cancel"
                 />
            )}
        </div>
    );
};

// --- FILE PARSERS (sem alterações) ---
// ... (Suas funções de parsing de arquivo estão aqui, sem alterações)


// --- RENDERIZAÇÃO INICIAL DA APP ---
const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);
