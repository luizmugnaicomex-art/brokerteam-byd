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



// ... (restante das funções auxiliares, como uuidv4, format, formatCurrency, etc.)

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



// NATIVE DATE-FNS REPLACEMENTS

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

// ... (todos os componentes permanecem aqui, sem grandes alterações na sua lógica interna)

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

  

const DashboardPage = ({ 

    imports, 

    claims, 

    tasks, 

    exchangeRates, 

    setExchangeRates, 

    currentUser,

    onNavigate

} : {

    imports: Shipment[],

    claims: Claim[],

    tasks: Task[],

    exchangeRates: ExchangeRates | null,

    setExchangeRates: (rates: ExchangeRates) => void,

    currentUser: User | null,

    onNavigate: (view: string, filter?: { type: string; value: string; }) => void

}) => {

    const [isRatesModalOpen, setIsRatesModalOpen] = useState(false);

    const [manualUSDCompra, setManualUSDCompra] = useState(exchangeRates?.usd.compra.toString() || '');

    const [manualUSDVenda, setManualUSDVenda] = useState(exchangeRates?.usd.venda.toString() || '');

    const [manualEURCompra, setManualEURCompra] = useState(exchangeRates?.eur.compra.toString() || '');

    const [manualEURVenda, setManualEURVenda] = useState(exchangeRates?.eur.venda.toString() || '');

    const [manualCNY, setManualCNY] = useState(exchangeRates?.cny.toString() || '');

    const [manualRatesError, setManualRatesError] = useState<string | null>(null);

    const [brokerViewMode, setBrokerViewMode] = useState<'di' | 'bl'>('bl');

  

    useEffect(() => {

        if (exchangeRates) {

            setManualUSDCompra(exchangeRates.usd.compra.toString());

            setManualUSDVenda(exchangeRates.usd.venda.toString());

            setManualEURCompra(exchangeRates.eur.compra.toString());

            setManualEURVenda(exchangeRates.eur.venda.toString());

            setManualCNY(exchangeRates.cny.toString());

        }

    }, [exchangeRates]);

  

    const handleSaveRates = () => {

        setManualRatesError(null);

        const newUSDCompra = parseFloat(manualUSDCompra);

        const newUSDVenda = parseFloat(manualUSDVenda);

        const newEURCompra = parseFloat(manualEURCompra);

        const newEURVenda = parseFloat(manualEURVenda);

        const newCNY = parseFloat(manualCNY);

  

        if (isNaN(newUSDCompra) || isNaN(newUSDVenda) || isNaN(newEURCompra) || isNaN(newEURVenda) || isNaN(newCNY)) {

            setManualRatesError("Please enter valid numbers for all exchange rates.");

            return;

        }

  

        setExchangeRates({

            date: new Date().toISOString().split('T')[0],

            time: format(new Date(), 'HH:mm'),

            usd: { compra: newUSDCompra, venda: newUSDVenda },

            eur: { compra: newEURCompra, venda: newEURVenda },

            cny: newCNY

        });

        setIsRatesModalOpen(false);

    };

  

    const kpis = useMemo(() => {

        const totalImports = imports.length;

        const deliveredImports = imports.filter(imp => imp.status === ImportStatus.Delivered).length;

        const inProgressImports = imports.filter(imp => imp.status !== ImportStatus.Delivered).length;

  

        const totalClaims = claims.length;

        const openClaims = claims.filter(claim => claim.status !== 'Resolved' && claim.status !== 'Rejected').length;

  

        let totalDemurrageCostUSD = 0;

        let totalOverduePaymentsUSD = 0;

        let totalOverdueTasks = 0;

        const importsAtRiskIds = new Set<string>();

        const today = new Date();

        today.setHours(0, 0, 0, 0);

  

        imports.forEach(imp => {

            if (imp.freeTimeDeadline) {

                const deadline = new Date(imp.freeTimeDeadline);

                if (isPast(deadline)) {

                    importsAtRiskIds.add(imp.id);

                }

            }

  

            imp.costs?.forEach(cost => {

                if (cost.dueDate && isPast(new Date(cost.dueDate)) && cost.status !== PaymentStatus.Paid && cost.status !== PaymentStatus.Cancelled) {

                    const valueInUSD = cost.currency === 'USD' ? cost.value : 

                                       cost.currency === 'BRL' && exchangeRates?.usd.venda ? cost.value / exchangeRates.usd.venda :

                                       cost.currency === 'EUR' && exchangeRates?.eur.venda ? cost.value / exchangeRates.eur.venda :

                                       cost.currency === 'CNY' && exchangeRates?.cny ? cost.value / exchangeRates.cny : 0;

                    totalOverduePaymentsUSD += valueInUSD;

                      importsAtRiskIds.add(imp.id);

                }

            });

        });

  

        totalOverdueTasks = tasks.filter(task => 

            currentUser && task.assignedToId === currentUser.id && 

            task.status !== TaskStatus.Completed &&

            task.dueDate && isPast(new Date(task.dueDate))

        ).length;

  

        return {

            totalImports,

            deliveredImports,

            inProgressImports,

            totalClaims,

            openClaims,

            totalDemurrageCostUSD: totalDemurrageCostUSD.toFixed(2),

            totalOverduePaymentsUSD: totalOverduePaymentsUSD.toFixed(2),

            totalOverdueTasks,

            importsAtRisk: importsAtRiskIds.size,

            importsAtRiskIds,

        };

    }, [imports, claims, exchangeRates, tasks, currentUser]);

  

    const importsByStatusData = useMemo(() => {

        const statusCounts: Record<string, number> = {};

        imports.forEach(imp => {

            statusCounts[imp.status || 'Unknown'] = (statusCounts[imp.status || 'Unknown'] || 0) + 1;

        });

  

        const labels = Object.values(ImportStatus);

        const data = labels.map(label => statusCounts[label] || 0);

  

        return {

            labels,

            datasets: [{

                label: 'Number of Imports',

                data,

                backgroundColor: [

                    'rgba(201, 203, 207, 0.6)', // Order Placed

                    'rgba(153, 102, 255, 0.6)', // Shipment Confirmed

                    'rgba(232, 62, 140, 0.6)',  // Document Review (Pink)

                    'rgba(255, 159, 64, 0.6)', // In Transit

                    'rgba(255, 206, 86, 0.6)', // At The Port

                    'rgba(23, 162, 184, 0.6)',  // DI Registered (Cyan)

                    'rgba(32, 201, 151, 0.6)',  // Cargo Ready (Teal)

                    'rgba(54, 162, 235, 0.6)', // Cargo Cleared

                    'rgba(75, 192, 192, 0.6)', // Cargo Delivered

                    'rgba(173, 181, 189, 0.6)',// Empty (Vazias)

                ],

            }],

        };

    }, [imports]);

  

    const brokerKpis = useMemo(() => {

        const countsByWarehouse: { [key: string]: number } = {};

        const countsByBroker: { [key: string]: number } = {};

        const parametrizationCounts: { [key: string]: number } = {};

  

        const filteredForView = imports.filter(imp => {

            if (brokerViewMode === 'di') {

                return imp.di && imp.di.trim() !== '';

            }

            return true; // 'bl' mode includes all shipments

        });

  

        filteredForView.forEach(imp => {

            if (imp.bondedWarehouse) {

                countsByWarehouse[imp.bondedWarehouse] = (countsByWarehouse[imp.bondedWarehouse] || 0) + 1;

            }

            if (imp.broker) {

                countsByBroker[imp.broker] = (countsByBroker[imp.broker] || 0) + 1;

            }

        });

        

        // Parametrization is always counted from all imports, regardless of view

        imports.forEach(imp => {

            if (imp.parametrization) {

                const channel = imp.parametrization.trim().toUpperCase();

                if (channel && channel !== 'PARAMETRIZATION') { // Filter out invalid data

                    parametrizationCounts[channel] = (parametrizationCounts[channel] || 0) + 1;

                }

            }

        });

  

        const dataByWarehouse = Object.entries(countsByWarehouse).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

        const dataByBroker = Object.entries(countsByBroker).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

        const parametrizationData = Object.entries(parametrizationCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

  

        return { dataByWarehouse, dataByBroker, parametrizationData };

    }, [imports, brokerViewMode]);

    

     const avgWarehouseTimeKpi = useMemo(() => {

        const durations: number[] = [];

        imports.forEach(imp => {

            const presence = parseDate(imp.cargoPresenceDate);

            const ready = parseDate(imp.cargoReady);

            if (presence && ready && ready > presence) {

                durations.push(differenceInDays(ready, presence));

            }

        });

        if (durations.length === 0) return { avg: 0, count: 0 };

        const totalDays = durations.reduce((sum, d) => sum + d, 0);

        return { avg: Math.round(totalDays / durations.length), count: durations.length };

    }, [imports]);

  

    const carsByModelKpi = useMemo(() => {

        const modelData: { [key: string]: { name: string; count: number; poList: Set<string> } } = {};

        const countedPOs = new Set<string>();

  

        imports.forEach(imp => {

            if (imp.typeOfCargo) {

                if (!modelData[imp.typeOfCargo]) {

                    modelData[imp.typeOfCargo] = { name: imp.typeOfCargo, count: 0, poList: new Set() };

                }

                if (imp.poSap) {

                    modelData[imp.typeOfCargo].poList.add(imp.poSap);

                    if (imp.qtyCarBattery && imp.qtyCarBattery > 0 && !countedPOs.has(imp.poSap)) {

                        modelData[imp.typeOfCargo].count += imp.qtyCarBattery;

                        countedPOs.add(imp.poSap);

                    }

                } else if (imp.qtyCarBattery && imp.qtyCarBattery > 0) {

                    modelData[imp.typeOfCargo].count += imp.qtyCarBattery;

                }

            }

        });

  

        return Object.values(modelData).sort((a, b) => b.count - a.count);

    }, [imports]);

  

  

    const handleStatusChartClick = (status: string) => {

        onNavigate('Imports', { type: 'status', value: status });

    };

  

    return (

        <div className="dashboard-page">

            <header>

                 <h1>Inbound Shipments Dashboard</h1>

            </header>

            <div className="kpi-grid">

                <button className="kpi-card kpi-card-clickable" onClick={() => onNavigate('Imports')}>

                    <div>

                        <p className="kpi-title">Total BLs / Imports</p>

                        <p className="kpi-value">{kpis.totalImports}</p>

                    </div>

                    <LayersIcon />

                </button>

                <button className="kpi-card kpi-card-clickable" onClick={() => onNavigate('Imports', { type: 'status', value: 'inProgress' })}>

                    <div>

                        <p className="kpi-title">Imports In Progress</p>

                        <p className="kpi-value">{kpis.inProgressImports}</p>

                    </div>

                    <TruckIcon />

                </button>

                <button className="kpi-card kpi-card-clickable" onClick={() => onNavigate('Imports', { type: 'status', value: ImportStatus.Delivered })}>

                    <div>

                        <p className="kpi-title">Imports Delivered</p>

                        <p className="kpi-value">{kpis.deliveredImports}</p>

                    </div>

                    <CheckCircleIcon />

                </button>

                 <div className="kpi-card">

                    <div>

                        <p className="kpi-title">Avg. Warehouse Time</p>

                        <p className="kpi-value">{avgWarehouseTimeKpi.avg} <span className="kpi-unit">days</span></p>

                    </div>

                    <ClockIcon />

                </div>

                <button className="kpi-card kpi-card-clickable" onClick={() => onNavigate('Imports', { type: 'blList', value: Array.from(kpis.importsAtRiskIds).join(',') })}>

                    <div>

                        <p className="kpi-title">Imports At Risk (Demurrage/Overdue)</p>

                        <p className="kpi-value kpi-danger">{kpis.importsAtRisk}</p>

                    </div>

                    <AlertTriangleIcon />

                </button>

                <div className="kpi-card">

                    <div>

                        <p className="kpi-title">My Overdue Tasks</p>

                        <p className="kpi-value kpi-danger">{kpis.totalOverdueTasks}</p>

                    </div>

                    <ListChecksIcon />

                </div>

            </div>

  

            <div className="dashboard-grid">

                <div className="dashboard-card chart-card">

                    <BarChart data={importsByStatusData} onBarClick={handleStatusChartClick} />

                </div>

  

                <div className="dashboard-card">

                    <h3 className="card-title">

                        <DollarSignIcon /> Exchange Rates

                        <button onClick={() => setIsRatesModalOpen(true)} className="edit-rates-btn">

                            <EditIcon />

                        </button>

                    </h3>

                    {exchangeRates ? (

                        <div className="rates-content">

                            <p className="rates-updated">Last updated: {exchangeRates.date} {exchangeRates.time}</p>

                            <div className="rates-grid">

                                <div className="rate-label">USD/BRL:</div>

                                <div>Compra: {exchangeRates.usd.compra.toFixed(4)} | Venda: {exchangeRates.usd.venda.toFixed(4)}</div>

                                <div className="rate-label">EUR/BRL:</div>

                                <div>Compra: {exchangeRates.eur.compra.toFixed(4)} | Venda: {exchangeRates.eur.venda.toFixed(4)}</div>

                                <div className="rate-label">CNY/BRL:</div>

                                <div>{exchangeRates.cny.toFixed(4)}</div>

                            </div>

                        </div>

                    ) : (

                        <div className="card-placeholder">No exchange rates available.</div>

                    )}

                </div>

            </div>

            

             <div className="dashboard-section-header with-actions">

                <h2>Broker Department Overview</h2>

                <div className="view-toggle">

                    <button 

                        className={`toggle-btn ${brokerViewMode === 'bl' ? 'active' : ''}`}

                        onClick={() => setBrokerViewMode('bl')}

                        aria-pressed={brokerViewMode === 'bl'}

                    >

                        View by BL

                    </button>

                    <button 

                        className={`toggle-btn ${brokerViewMode === 'di' ? 'active' : ''}`}

                        onClick={() => setBrokerViewMode('di')}

                        aria-pressed={brokerViewMode === 'di'}

                    >

                        View by DI

                    </button>

                </div>

            </div>

            <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>

                <div className="dashboard-card">

                    <h3 className="card-title">Customs Channels</h3>

                    {brokerKpis.parametrizationData.length > 0 ? (

                        <ul className="kpi-list">

                            {brokerKpis.parametrizationData.map(item => (

                                <li key={item.name}>

                                     <button className="kpi-list-button" onClick={() => onNavigate('Imports', { type: 'parametrization', value: toTitleCase(item.name) })}>

                                        <span>{toTitleCase(item.name)} Channel</span>

                                        <strong>{item.count}</strong>

                                    </button>

                                </li>

                            ))}

                        </ul>

                    ) : <div className="card-placeholder">No parametrization data.</div>}

                </div>

  

                <div className="dashboard-card">

                    <h3 className="card-title">{brokerViewMode === 'bl' ? 'BLs' : 'DIs'} per Terminal</h3>

                    {brokerKpis.dataByWarehouse.length > 0 ? (

                        <ul className="kpi-list">

                            {brokerKpis.dataByWarehouse.map(item => (

                                <li key={item.name}>

                                    <button className="kpi-list-button" onClick={() => onNavigate('Imports', { type: 'warehouse', value: item.name })}>

                                        <span>{item.name}</span>

                                        <strong>{item.count}</strong>

                                    </button>

                                </li>

                            ))}

                        </ul>

                    ) : <div className="card-placeholder">No data for this view.</div>}

                </div>

  

                <div className="dashboard-card">

                    <h3 className="card-title">{brokerViewMode === 'bl' ? 'BLs' : 'DIs'} per Broker</h3>

                    {brokerKpis.dataByBroker.length > 0 ? (

                        <ul className="kpi-list">

                            {brokerKpis.dataByBroker.map(item => (

                                <li key={item.name}>

                                    <button className="kpi-list-button" onClick={() => onNavigate('Imports', { type: 'broker', value: item.name })}>

                                        <span>{item.name}</span>

                                        <strong>{item.count}</strong>

                                    </button>

                                </li>

                            ))}

                        </ul>

                    ) : <div className="card-placeholder">No data for this view.</div>}

                </div>

                

                 <div className="dashboard-card">

                    <h3 className="card-title">Car Quantity by Model</h3>

                    {carsByModelKpi.length > 0 ? (

                        <ul className="kpi-list">

                            {carsByModelKpi.map(item => (

                                <li key={item.name}>

                                    <button 

                                        className="kpi-list-button" 

                                        onClick={() => onNavigate('Imports', { type: 'poList', value: Array.from(item.poList).join(',') })}

                                        disabled={item.poList.size === 0}

                                    >

                                        <span>{item.name}</span>

                                        <strong>{item.count}</strong>

                                    </button>

                                </li>

                            ))}

                        </ul>

                    ) : <div className="card-placeholder">No car data available.</div>}

                </div>

            </div>

            

  

            {isRatesModalOpen && (

                <div className="modal-overlay animate-fade-in" onClick={() => setIsRatesModalOpen(false)}>

                    <div className="modal-content animate-scale-in" onClick={e => e.stopPropagation()}>

                        <div className="modal-header">

                            <h3 className="modal-title">Set Exchange Rates</h3>

                            <button onClick={() => setIsRatesModalOpen(false)} className="close-button"><CloseIcon /></button>

                        </div>

                        <div className="modal-body">

                            {manualRatesError && <div className="error-banner"><AlertCircleIcon /> {manualRatesError}</div>}

                            <div className="form-group">

                                <label>USD Compra</label>

                                <input type="number" step="0.0001" value={manualUSDCompra} onChange={(e) => setManualUSDCompra(e.target.value)} />

                            </div>

                            <div className="form-group">

                                <label>USD Venda</label>

                                <input type="number" step="0.0001" value={manualUSDVenda} onChange={(e) => setManualUSDVenda(e.target.value)} />

                            </div>

                             <div className="form-group">

                                <label>EUR Compra</label>

                                <input type="number" step="0.0001" value={manualEURCompra} onChange={(e) => setManualEURCompra(e.target.value)} />

                            </div>

                            <div className="form-group">

                                <label>EUR Venda</label>

                                <input type="number" step="0.0001" value={manualEURVenda} onChange={(e) => setManualEURVenda(e.target.value)} />

                            </div>

                             <div className="form-group">

                                <label>CNY (to BRL)</label>

                                <input type="number" step="0.0001" value={manualCNY} onChange={(e) => setManualCNY(e.target.value)} />

                            </div>

                        </div>

                        <div className="modal-actions-footer">

                            <button onClick={() => setIsRatesModalOpen(false)} className="btn-discard">Cancel</button>

                            <button onClick={handleSaveRates} className="btn-create">Save Rates</button>

                        </div>

                    </div>

                </div>

            )}

        </div>

    );

};

  

const MultiSelectDropdown = ({ options, selectedOptions, onChange, placeholder = 'Select...' }: { options: string[], selectedOptions: string[], onChange: (selected: string[]) => void, placeholder?: string }) => {

    const [isOpen, setIsOpen] = useState(false);

    const dropdownRef = useRef<HTMLDivElement>(null);

  

    useEffect(() => {

        const handleClickOutside = (event: MouseEvent) => {

            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {

                setIsOpen(false);

            }

        };

        document.addEventListener('mousedown', handleClickOutside);

        return () => {

            document.removeEventListener('mousedown', handleClickOutside);

        };

    }, []);

  

    const handleOptionToggle = (option: string) => {

        const newSelected = selectedOptions.includes(option)

            ? selectedOptions.filter(o => o !== option)

            : [...selectedOptions, option];

        onChange(newSelected);

    };

  

    const displayLabel = selectedOptions.length === 0

        ? placeholder

        : selectedOptions.length === 1

            ? selectedOptions[0]

            : `${selectedOptions.length} statuses selected`;

  

    return (

        <div className="multiselect-dropdown" ref={dropdownRef}>

            <button type="button" className="dropdown-btn" onClick={() => setIsOpen(!isOpen)}>

                <span>{displayLabel}</span>

                <ChevronDownIcon />

            </button>

            {isOpen && (

                <div className="dropdown-content">

                    {options.map(option => (

                        <label key={option} className="dropdown-item">

                            <input

                                type="checkbox"

                                checked={selectedOptions.includes(option)}

                                onChange={() => handleOptionToggle(option)}

                            />

                            {option}

                        </label>

                    ))}

                    {selectedOptions.length > 0 && (

                         <button className="dropdown-clear-btn" onClick={() => onChange([])}>Clear selection</button>

                    )}

                </div>

            )}

        </div>

    );

};

  

const ImportListPage = ({ imports, onSelect, onNew, onUpdate, onDelete, onBulkImport, initialFilter, onClearInitialFilter }: { imports: Shipment[], onSelect: (id: string) => void, onNew: () => void, onUpdate: (shipment: Shipment) => void, onDelete: (id: string) => void, onBulkImport: (data: Shipment[]) => void, initialFilter: { type: string, value: string } | null, onClearInitialFilter: () => void }) => {

    const [searchTerm, setSearchTerm] = useState('');

    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

    const [statusFilter, setStatusFilter] = useState<string[]>([]);

    const [brokerFilter, setBrokerFilter] = useState('All');

    const [warehouseFilter, setWarehouseFilter] = useState('All');

    const [parametrizationFilter, setParametrizationFilter] = useState('All');

    const [blListFilter, setBlListFilter] = useState<string[] | null>(null);

    const [poListFilter, setPoListFilter] = useState<string[] | null>(null);

    const [editingRow, setEditingRow] = useState<Partial<Shipment> | null>(null);

    

    const topScrollRef = useRef<HTMLDivElement>(null);

    const bottomScrollRef = useRef<HTMLDivElement>(null);

    const tableRef = useRef<HTMLTableElement>(null);

  

    const filteredImports = useMemo(() => {

        return imports.filter(imp => {

            if (blListFilter) {

                return blListFilter.includes(imp.id);

            }

            if (poListFilter) {

                return imp.poSap ? poListFilter.includes(imp.poSap) : false;

            }

  

            const lowercasedFilter = searchTerm.toLowerCase();

            const matchesSearch = !searchTerm || (

                imp.blAwb.toLowerCase().includes(lowercasedFilter) ||

                (imp.description && imp.description.toLowerCase().includes(lowercasedFilter)) ||

                (imp.poSap && String(imp.poSap).toLowerCase().includes(lowercasedFilter)) ||

                (imp.di && String(imp.di).toLowerCase().includes(lowercasedFilter)) ||

                (imp.arrivalVessel && imp.arrivalVessel.toLowerCase().includes(lowercasedFilter)) ||

                (imp.shipper && imp.shipper.toLowerCase().includes(lowercasedFilter)) ||

                (imp.bondedWarehouse && imp.bondedWarehouse.toLowerCase().includes(lowercasedFilter))

            );

  

            const matchesStatus = statusFilter.length === 0 || (imp.status ? statusFilter.includes(imp.status) : false);

            const matchesBroker = brokerFilter === 'All' || imp.broker === brokerFilter;

            const matchesWarehouse = warehouseFilter === 'All' || imp.bondedWarehouse === warehouseFilter;

            const matchesParametrization = parametrizationFilter === 'All' || toTitleCase(imp.parametrization) === parametrizationFilter;

  

            return matchesSearch && matchesStatus && matchesBroker && matchesWarehouse && matchesParametrization;

        });

    }, [imports, searchTerm, statusFilter, brokerFilter, warehouseFilter, parametrizationFilter, blListFilter, poListFilter]);

  

    useLayoutEffect(() => {

        const topDiv = topScrollRef.current;

        const bottomDiv = bottomScrollRef.current;

        const table = tableRef.current;

  

        if (!topDiv || !bottomDiv || !table) return;

  

        const topInner = topDiv.firstChild as HTMLDivElement;

        if (!topInner) return;

  

        const updateWidth = () => {

            if (table.scrollWidth > table.clientWidth) {

                topInner.style.width = `${table.scrollWidth}px`;

                topDiv.style.display = 'block';

            } else {

                topDiv.style.display = 'none';

            }

        };

  

        updateWidth();

  

        let isSyncing = false;

        const syncScroll = (source: HTMLDivElement, target: HTMLDivElement) => {

            if (isSyncing) return;

            isSyncing = true;

            target.scrollLeft = source.scrollLeft;

            requestAnimationFrame(() => {

                isSyncing = false;

            });

        };

        

        const handleTopScroll = () => syncScroll(topDiv, bottomDiv);

        const handleBottomScroll = () => syncScroll(bottomDiv, topDiv);

  

        topDiv.addEventListener('scroll', handleTopScroll);

        bottomDiv.addEventListener('scroll', handleBottomScroll);

        

        const resizeObserver = new ResizeObserver(updateWidth);

        resizeObserver.observe(table);

        resizeObserver.observe(bottomDiv);

  

        return () => {

            topDiv.removeEventListener('scroll', handleTopScroll);

            bottomDiv.removeEventListener('scroll', handleBottomScroll);

            resizeObserver.disconnect();

        };

    }, [filteredImports]);

  

    useEffect(() => {

        if (initialFilter) {

            // Reset all filters first

            setStatusFilter([]);

            setBrokerFilter('All');

            setWarehouseFilter('All');

            setParametrizationFilter('All');

            setBlListFilter(null);

            setPoListFilter(null);

            setSearchTerm('');

  

            switch (initialFilter.type) {

                case 'warehouse':

                    setWarehouseFilter(initialFilter.value);

                    break;

                case 'broker':

                    setBrokerFilter(initialFilter.value);

                    break;

                case 'status':

                    if (initialFilter.value === 'inProgress') {

                        const inProgressStatuses = Object.values(ImportStatus).filter(s => s !== ImportStatus.Delivered);

                        setStatusFilter(inProgressStatuses);

                    } else if (Object.values(ImportStatus).includes(initialFilter.value as ImportStatus)) {

                        setStatusFilter([initialFilter.value]);

                    }

                    break;

                case 'parametrization':

                    setParametrizationFilter(initialFilter.value);

                    break;

                case 'blList':

                    setBlListFilter(initialFilter.value.split(','));

                    break;

                case 'poList':

                    setPoListFilter(initialFilter.value.split(','));

                    break;

            }

            onClearInitialFilter();

        }

    }, [initialFilter, onClearInitialFilter]);

  

    const uniqueBrokers = useMemo(() => [...new Set(imports.map(i => i.broker).filter(Boolean).sort())], [imports]);

    const uniqueWarehouses = useMemo(() => [...new Set(imports.map(i => i.bondedWarehouse).filter(Boolean).sort())], [imports]);

    

    const uniqueParametrizations = useMemo(() => {

        const channels = imports

            .map(i => i.parametrization)

            .filter((p): p is string => !!p && p.trim() !== '' && p.trim().toUpperCase() !== 'PARAMETRIZATION')

            .map(p => toTitleCase(p));

        return [...new Set(channels)].sort((a, b) => a.localeCompare(b));

    }, [imports]);

    

    const createFilterChangeHandler = <T extends Function>(setter: T) => (e: React.ChangeEvent<HTMLSelectElement>) => {

        setter(e.target.value);

        setBlListFilter(null); // Clear special BL list filter when a manual filter is applied

        setPoListFilter(null);

    };

    

    const handleBrokerChange = createFilterChangeHandler(setBrokerFilter);

    const handleWarehouseChange = createFilterChangeHandler(setWarehouseFilter);

    const handleParametrizationChange = createFilterChangeHandler(setParametrizationFilter);

  

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {

        setSearchTerm(e.target.value);

        setBlListFilter(null);

        setPoListFilter(null);

    }

    

    const handleStatusSelectionChange = (selected: string[]) => {

        setStatusFilter(selected);

        setBlListFilter(null);

        setPoListFilter(null);

    };

  

    const handleImportConfirm = (data: Shipment[]) => {

        onBulkImport(data);

        setIsUploadModalOpen(false);

    };

  

    const handleInlineEditStart = (shipment: Shipment) => {

        setEditingRow({ ...shipment });

    };

  

    const handleInlineCancel = () => {

        setEditingRow(null);

    };

  

    const handleInlineChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {

        if (!editingRow) return;

        const { name, value } = e.target;

        setEditingRow(prev => ({ ...prev, [name]: value }));

    };

  

    const handleInlineSave = () => {

        if (!editingRow || !editingRow.id) return;

  

        const originalShipment = imports.find(s => s.id === editingRow!.id);

        if (!originalShipment) return;

  

        const finalData = { ...originalShipment, ...editingRow };

  

        // Convert display dates back to ISO format before saving

        const dateFields: (keyof Shipment)[] = ['diRegistrationDate', 'greenChannelOrDeliveryAuthorizedDate', 'firstTruckDelivery', 'lastTruckDelivery'];

        dateFields.forEach(field => {

            const value = finalData[field] as string;

            if (value && /^\d{2}\/\d{2}\/\d{4}$/.test(value)) {

                (finalData as any)[field] = fromDisplayDate(value);

            }

        });

        

        onUpdate(finalData as Shipment);

        setEditingRow(null);

    };

    

    const handleEditClick = (e: React.MouseEvent, shipment: Shipment) => {

        e.stopPropagation();

        handleInlineEditStart(shipment);

    };

  

    return (

        <div className="imports-list-page">

             <div className="table-wrapper">

                <div className="table-header">

                    <h2>All Imports</h2>

                    <div className="table-actions">

                        <input

                            type="text"

                            placeholder="Search by BL, PO, description..."

                            className="search-bar"

                            value={searchTerm}

                            onChange={handleSearchChange}

                        />

                        <MultiSelectDropdown

                            options={Object.values(ImportStatus)}

                            selectedOptions={statusFilter}

                            onChange={handleStatusSelectionChange}

                            placeholder="All Statuses"

                        />

                        <select className="status-filter" value={brokerFilter} onChange={handleBrokerChange}>

                            <option value="All">All Brokers</option>

                            {uniqueBrokers.map(b => <option key={b} value={b}>{b}</option>)}

                        </select>

                        <select className="status-filter" value={warehouseFilter} onChange={handleWarehouseChange}>

                            <option value="All">All Warehouses</option>

                            {uniqueWarehouses.map(w => <option key={w} value={w}>{w}</option>)}

                        </select>

                        <select className="status-filter" value={parametrizationFilter} onChange={handleParametrizationChange}>

                            <option value="All">All Channels</option>

                            {uniqueParametrizations.map(p => <option key={p} value={p}>{p}</option>)}

                        </select>

                        <button onClick={() => setIsUploadModalOpen(true)} className="btn-secondary">

                            <UploadIcon /> Upload File

                        </button>

                        <button onClick={onNew} className="new-import-btn">New Import</button>

                    </div>

                </div>

                <div ref={topScrollRef} className="top-scrollbar">

                    <div />

                </div>

                <div ref={bottomScrollRef} className="table-container">

                    <table ref={tableRef} className="shipments-table">

                        <thead>

                            <tr>

                                <th>BL/AWB</th>

                                <th>PO SAP</th>

                                <th>Shipper</th>

                                <th>Description</th>

                                <th>Arrival Vessel</th>

                                <th>DI</th>

                                <th>DI Reg. Date</th>

                                <th>Channel</th>

                                <th>Delivery Auth. Date</th>

                                <th>First Truck Delivery</th>

                                <th>Last Truck Delivery</th>

                                <th>Status</th>

                                <th>Actions</th>

                            </tr>

                        </thead>

                        <tbody>

                            {filteredImports.map(imp => {

                                const isEditing = editingRow?.id === imp.id;

                                return (

                                <tr key={imp.id} >

                                    <td><button className="link-button" onClick={() => !isEditing && onSelect(imp.id)}>{imp.blAwb}</button></td>

                                    <td>{imp.poSap}</td>

                                    <td>{imp.shipper}</td>

                                    <td>{imp.description}</td>

                                    <td>{imp.arrivalVessel}</td>

                                    <td>

                                        {isEditing ? (

                                            <input type="text" name="di" value={editingRow?.di || ''} onChange={handleInlineChange} onClick={e => e.stopPropagation()} className="inline-edit-input" />

                                        ) : (

                                            imp.di

                                        )}

                                    </td>

                                    <td>

                                        {isEditing ? (

                                            <input type="text" name="diRegistrationDate" placeholder="dd/mm/yyyy" value={toDisplayDate(editingRow?.diRegistrationDate)} onChange={handleInlineChange} onClick={e => e.stopPropagation()} className="inline-edit-input" />

                                        ) : (

                                            toDisplayDate(imp.diRegistrationDate)

                                        )}

                                    </td>

                                     <td>

                                        {isEditing ? (

                                            <input type="text" name="parametrization" value={editingRow?.parametrization || ''} onChange={handleInlineChange} onClick={e => e.stopPropagation()} className="inline-edit-input" />

                                        ) : (

                                            imp.parametrization

                                        )}

                                    </td>

                                    <td>

                                        {isEditing ? (

                                            <input type="text" name="greenChannelOrDeliveryAuthorizedDate" placeholder="dd/mm/yyyy" value={toDisplayDate(editingRow?.greenChannelOrDeliveryAuthorizedDate)} onChange={handleInlineChange} onClick={e => e.stopPropagation()} className="inline-edit-input" />

                                        ) : (

                                            toDisplayDate(imp.greenChannelOrDeliveryAuthorizedDate)

                                        )}

                                    </td>

                                    <td>

                                        {isEditing ? (

                                            <input type="text" name="firstTruckDelivery" placeholder="dd/mm/yyyy" value={toDisplayDate(editingRow?.firstTruckDelivery)} onChange={handleInlineChange} onClick={e => e.stopPropagation()} className="inline-edit-input" />

                                        ) : (

                                            toDisplayDate(imp.firstTruckDelivery)

                                        )}

                                    </td>

                                    <td>

                                        {isEditing ? (

                                            <input type="text" name="lastTruckDelivery" placeholder="dd/mm/yyyy" value={toDisplayDate(editingRow?.lastTruckDelivery)} onChange={handleInlineChange} onClick={e => e.stopPropagation()} className="inline-edit-input" />

                                        ) : (

                                            toDisplayDate(imp.lastTruckDelivery)

                                        )}

                                    </td>

                                    <td>

                                        {isEditing ? (

                                            <select 

                                                name="status" 

                                                value={editingRow?.status || ''} 

                                                onChange={handleInlineChange} 

                                                onClick={e => e.stopPropagation()} 

                                                className="inline-edit-input"

                                            >

                                                {Object.values(ImportStatus).map(s => <option key={s} value={s}>{s}</option>)}

                                            </select>

                                        ) : (

                                            <span className={`status-pill ${getStatusPillClass(imp.status)}`}>{imp.status}</span>

                                        )}

                                    </td>

                                    <td className="actions-cell">

                                        {isEditing ? (

                                            <>

                                                <button className="action-btn save-btn" onClick={(e) => { e.stopPropagation(); handleInlineSave(); }} aria-label={`Save changes for ${imp.blAwb}`}><SaveIcon /> Save</button>

                                                <button className="action-btn cancel-btn" onClick={(e) => { e.stopPropagation(); handleInlineCancel(); }} aria-label={`Cancel editing for ${imp.blAwb}`}><CancelIcon /> Cancel</button>

                                            </>

                                        ) : (

                                            <>

                                                <button className="action-btn edit-btn" onClick={(e) => handleEditClick(e, imp)} aria-label={`Edit ${imp.blAwb}`}><EditIcon /> Edit</button>

                                                <button className="action-btn delete-btn" onClick={(e) => { e.stopPropagation(); onDelete(imp.id); }} aria-label={`Delete ${imp.blAwb}`}><TrashIcon /> Delete</button>

                                            </>

                                        )}

                                    </td>

                                </tr>

                            )})}

                        </tbody>

                    </table>

                </div>

            </div>

            {isUploadModalOpen && (

                <UploadModal 

                    onCancel={() => setIsUploadModalOpen(false)}

                    onImport={handleImportConfirm}

                    parser={parseGeneralShipmentFile}

                    title="Upload Shipments from File"

                />

            )}

        </div>

    );

};

  

const ImportFormPage = ({ onSave, onCancel, existingImport }: { onSave: (shipment: Shipment) => void, onCancel: () => void, existingImport?: Shipment }) => {

    const [shipment, setShipment] = useState<Shipment>(existingImport || {

        id: '', blAwb: 'TBC', status: ImportStatus.OrderPlaced, containers: [], costs: []

    });

  

    useEffect(() => {

        const { actualEta, actualEtd, freeTime, incoterm, bondedWarehouse } = shipment;

  

        const etaDate = parseDate(actualEta);

        const etdDate = parseDate(actualEtd);

  

        const updates: Partial<Shipment> = {};

  

        // 1. Transit Time

        let newTransitTime: number | undefined;

        if (etaDate && etdDate && etaDate >= etdDate) {

            newTransitTime = differenceInDays(etaDate, etdDate);

        }

        updates.transitTime = newTransitTime;

  

        // 2. Free Time Deadline

        let newFreeTimeDeadline = '';

        if (etaDate && typeof freeTime === 'number' && freeTime > 0) {

            const deadlineDate = addDays(etaDate, freeTime - 1);

            const y = deadlineDate.getFullYear();

            const m = (deadlineDate.getMonth() + 1).toString().padStart(2, '0');

            const d = deadlineDate.getDate().toString().padStart(2, '0');

            newFreeTimeDeadline = `${y}-${m}-${d}`;

        }

        updates.freeTimeDeadline = newFreeTimeDeadline;

        

        // 3. Storage Deadline

        const newStorageDeadline = calculateStorageDeadline(incoterm, bondedWarehouse, actualEta);

        updates.storageDeadline = newStorageDeadline;

  

        setShipment(prev => {

            if (

                prev.transitTime !== updates.transitTime ||

                prev.freeTimeDeadline !== updates.freeTimeDeadline ||

                prev.storageDeadline !== updates.storageDeadline

            ) {

                return { ...prev, ...updates };

            }

            return prev;

        });

  

    }, [shipment.actualEta, shipment.actualEtd, shipment.freeTime, shipment.incoterm, shipment.bondedWarehouse]);

  

  

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {

        const { name, value, type } = e.target;

        

        let processedValue: string | number | undefined = value;

        const numberFields: (keyof Shipment)[] = ['qtyCarBattery', 'cbm', 'fcl', 'lcl', 'containerUnloaded', 'freeTime', 'invoiceValue', 'freightValue', 'qtyContainerInspection', 'taxRateCny', 'taxRateUsd', 'nfValuePerContainer'];

        const dateFields: (keyof Shipment)[] = ['ieSentToBroker', 'approvedDraftDi', 'actualEtd', 'actualEta', 'cargoPresenceDate', 'diRegistrationDate', 'greenChannelOrDeliveryAuthorizedDate', 'draftNf', 'approvedDraftNf', 'nfIssueDate', 'cargoReady', 'firstTruckDelivery', 'lastTruckDelivery', 'invoicePaymentDate', 'draftDi'];

        

        if (numberFields.includes(name as keyof Shipment)) {

            processedValue = value === '' ? undefined : parseFloat(value);

        } else if (dateFields.includes(name as keyof Shipment)) {

            if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {

                processedValue = fromDisplayDate(value);

            }

            // Otherwise, keep the partial string as is

        }

  

        setShipment(prev => ({ ...prev, [name]: processedValue }));

    };

  

    const handleSubmit = (e: React.FormEvent) => {

        e.preventDefault();

        onSave(shipment);

    };

  

    return (

        <div className="import-form-page">

            <header>

                <button className="back-button" onClick={onCancel}><BackIcon /> Back to List</button>

            </header>

             <form onSubmit={handleSubmit}>

                <div className="detail-card">

                    <h3>{existingImport ? 'Edit Import Process' : 'New Import Process'}</h3>

                    <div className="form-grid-3col">

                         <div className="form-group">

                            <label htmlFor="blAwb">BL/AWB</label>

                            <input type="text" id="blAwb" name="blAwb" value={shipment.blAwb} onChange={handleChange} required />

                        </div>

                        <div className="form-group">

                            <label htmlFor="shipper">Shipper</label>

                            <input type="text" id="shipper" name="shipper" value={shipment.shipper || ''} onChange={handleChange} />

                        </div>

                         <div className="form-group">

                            <label htmlFor="poSap">PO SAP</label>

                            <input type="text" id="poSap" name="poSap" value={shipment.poSap || ''} onChange={handleChange} />

                        </div>

                        <div className="form-group">

                            <label htmlFor="invoice">Invoice</label>

                            <input type="text" id="invoice" name="invoice" value={shipment.invoice || ''} onChange={handleChange} />

                        </div>

                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>

                            <label htmlFor="description">Description</label>

                            <input type="text" id="description" name="description" value={shipment.description || ''} onChange={handleChange} />

                        </div>

                    </div>

                </div>

  

                <div className="detail-card">

                    <h3>Cargo &amp; Logistics Details</h3>

                    <div className="form-grid-3col">

                        <div className="form-group"><label>Type of Cargo</label><input type="text" name="typeOfCargo" value={shipment.typeOfCargo || ''} onChange={handleChange} /></div>

                        <div className="form-group"><label>Cost Center</label><input type="text" name="costCenter" value={shipment.costCenter || ''} onChange={handleChange} /></div>

                        <div className="form-group"><label>Qty Car/Battery</label><input type="number" name="qtyCarBattery" value={shipment.qtyCarBattery || ''} onChange={handleChange} /></div>

                        <div className="form-group"><label>Batch China</label><input type="text" name="batchChina" value={shipment.batchChina || ''} onChange={handleChange} /></div>

                        <div className="form-group"><label>Color</label><input type="text" name="color" value={shipment.color || ''} onChange={handleChange} /></div>

                        <div className="form-group"><label>Ex Tariff</label><input type="text" name="exTariff" value={shipment.exTariff || ''} onChange={handleChange} /></div>

                        <div className="form-group"><label>Shipment Type</label><input type="text" name="shipmentType" value={shipment.shipmentType || ''} onChange={handleChange} /></div>

                        <div className="form-group"><label>CBM</label><input type="number" step="0.01" name="cbm" value={shipment.cbm || ''} onChange={handleChange} /></div>

                        <div className="form-group"><label>FCL</label><input type="number" name="fcl" value={shipment.fcl || ''} onChange={handleChange} /></div>

                        <div className="form-group"><label>LCL</label><input type="number" name="lcl" value={shipment.lcl || ''} onChange={handleChange} /></div>

                        <div className="form-group"><label>Type Container</label><input type="text" name="typeContainer" value={shipment.typeContainer || ''} onChange={handleChange} /></div>

                        <div className="form-group"><label>Incoterm</label><input type="text" name="incoterm" value={shipment.incoterm || ''} onChange={handleChange} /></div>

                        <div className="form-group"><label>Container Unloaded</label><input type="number" name="containerUnloaded" value={shipment.containerUnloaded || ''} onChange={handleChange} /></div>

                        <div className="form-group"><label>Freight Forwarder Destination</label><input type="text" name="freightForwarderDestination" value={shipment.freightForwarderDestination || ''} onChange={handleChange} /></div>

                        <div className="form-group"><label>Shipowner</label><input type="text" name="shipowner" value={shipment.shipowner || ''} onChange={handleChange} /></div>

                        <div className="form-group"><label>Voyage</label><input type="text" name="voyage" value={shipment.voyage || ''} onChange={handleChange} /></div>

                        <div className="form-group"><label>Bonded Warehouse</label><input type="text" name="bondedWarehouse" value={shipment.bondedWarehouse || ''} onChange={handleChange} /></div>

                    </div>

                </div>

  

                <div className="detail-card">

                    <h3>Customs &amp; Broker Details</h3>

                     <div className="form-grid-3col">

                        <div className="form-group"><label>Broker</label><input type="text" name="broker" value={shipment.broker || ''} onChange={handleChange} /></div>

                        <div className="form-group"><label>Unique DI</label><select name="uniqueDi" value={shipment.uniqueDi || ''} onChange={handleChange}><option value="">Select</option><option value="Yes">Yes</option><option value="No">No</option></select></div>

                        <div className="form-group"><label>LI Nr.</label><input type="text" name="liNr" value={shipment.liNr || ''} onChange={handleChange} /></div>

                        <div className="form-group"><label>Status LI</label><input type="text" name="statusLi" value={shipment.statusLi || ''} onChange={handleChange} /></div>

                        <div className="form-group"><label>DI</label><input type="text" name="di" value={shipment.di || ''} onChange={handleChange} /></div>

                        <div className="form-group"><label>Parametrization</label><input type="text" name="parametrization" value={shipment.parametrization || ''} onChange={handleChange} /></div>

                        <div className="form-group"><label>DG (Dangerous Goods)</label><select name="dg" value={shipment.dg || ''} onChange={handleChange}><option value="">Select</option><option value="Yes">Yes</option><option value="No">No</option></select></div>

                        <div className="form-group"><label>Under Water</label><select name="underWater" value={shipment.underWater || ''} onChange={handleChange}><option value="">Select</option><option value="Yes">Yes</option><option value="No">No</option></select></div>

                        <div className="form-group"><label>Damage Report</label><select name="damageReport" value={shipment.damageReport || ''} onChange={handleChange}><option value="">Select</option><option value="Yes">Yes</option><option value="No">No</option></select></div>

                    </div>

                </div>

  

                 <div className="detail-card">

                    <h3>Dates & Deadlines</h3>

                     <div className="form-grid-3col">

                        <div className="form-group"><label>IE Sent to Broker</label><input type="text" name="ieSentToBroker" value={toDisplayDate(shipment.ieSentToBroker)} onChange={handleChange} placeholder="dd/mm/yyyy" /></div>

                        <div className="form-group"><label>Free Time (days)</label><input type="number" name="freeTime" value={shipment.freeTime || ''} onChange={handleChange} /></div>

                        <div className="form-group"><label>Free Time Deadline</label><input type="text" name="freeTimeDeadline" value={toDisplayDate(shipment.freeTimeDeadline)} placeholder="Auto-calculated" readOnly /></div>

                        <div className="form-group"><label>Arrival Vessel</label><input type="text" name="arrivalVessel" value={shipment.arrivalVessel || ''} onChange={handleChange} /></div>

                        <div className="form-group"><label>Actual ETD</label><input type="text" name="actualEtd" value={toDisplayDate(shipment.actualEtd)} onChange={handleChange} placeholder="dd/mm/yyyy"/></div>

                        <div className="form-group"><label>Actual ETA</label><input type="text" name="actualEta" value={toDisplayDate(shipment.actualEta)} onChange={handleChange} placeholder="dd/mm/yyyy"/></div>

                        <div className="form-group"><label>Transit Time (days)</label><input type="number" name="transitTime" value={shipment.transitTime ?? ''} placeholder="Auto-calculated" readOnly /></div>

                        <div className="form-group"><label>Storage Deadline</label><input type="text" name="storageDeadline" value={toDisplayDate(shipment.storageDeadline)} placeholder="Auto-calculated" readOnly /></div>

                        <div className="form-group"><label>Cargo Presence Date</label><input type="text" name="cargoPresenceDate" value={toDisplayDate(shipment.cargoPresenceDate)} onChange={handleChange} placeholder="dd/mm/yyyy" /></div>

                        <div className="form-group"><label>DI Registration Date</label><input type="text" name="diRegistrationDate" value={toDisplayDate(shipment.diRegistrationDate)} onChange={handleChange} placeholder="dd/mm/yyyy" /></div>

                        <div className="form-group"><label>Green Channel / Delivery Auth. Date</label><input type="text" name="greenChannelOrDeliveryAuthorizedDate" value={toDisplayDate(shipment.greenChannelOrDeliveryAuthorizedDate)} onChange={handleChange} placeholder="dd/mm/yyyy" /></div>

                        <div className="form-group"><label>Cargo Ready Date</label><input type="text" name="cargoReady" value={toDisplayDate(shipment.cargoReady)} onChange={handleChange} placeholder="dd/mm/yyyy" /></div>

                        <div className="form-group"><label>First Truck Delivery</label><input type="text" name="firstTruckDelivery" value={toDisplayDate(shipment.firstTruckDelivery)} onChange={handleChange} placeholder="dd/mm/yyyy" /></div>

                        <div className="form-group"><label>Last Truck Delivery</label><input type="text" name="lastTruckDelivery" value={toDisplayDate(shipment.lastTruckDelivery)} onChange={handleChange} placeholder="dd/mm/yyyy" /></div>

                        <div className="form-group"><label>Invoice Payment Date</label><input type="text" name="invoicePaymentDate" value={toDisplayDate(shipment.invoicePaymentDate)} onChange={handleChange} placeholder="dd/mm/yyyy" /></div>

                    </div>

                </div>



                 <div className="detail-card">

                    <h3>Financial &amp; NF Details</h3>

                     <div className="form-grid-3col">

                        <div className="form-group"><label>Invoice Currency</label><input type="text" name="invoiceCurrency" value={shipment.invoiceCurrency || ''} onChange={handleChange} /></div>

                        <div className="form-group"><label>Invoice Value</label><input type="number" step="0.01" name="invoiceValue" value={shipment.invoiceValue || ''} onChange={handleChange} /></div>

                        <div className="form-group"><label>Freight Currency</label><input type="text" name="freightCurrency" value={shipment.freightCurrency || ''} onChange={handleChange} /></div>

                        <div className="form-group"><label>Freight Value</label><input type="number" step="0.01" name="freightValue" value={shipment.freightValue || ''} onChange={handleChange} /></div>

                        <div className="form-group"><label>VLMD</label><input type="text" name="vlmd" value={shipment.vlmd || ''} onChange={handleChange} /></div>

                        <div className="form-group"><label>Tax Rate CNY</label><input type="number" step="0.01" name="taxRateCny" value={shipment.taxRateCny || ''} onChange={handleChange} /></div>

                        <div className="form-group"><label>Tax Rate USD</label><input type="number" step="0.01" name="taxRateUsd" value={shipment.taxRateUsd || ''} onChange={handleChange} /></div>

                        <div className="form-group"><label>CIF DI</label><input type="text" name="cifDi" value={shipment.cifDi || ''} onChange={handleChange} /></div>

                        <div className="form-group"><label>Draft NF Date</label><input type="text" name="draftNf" value={toDisplayDate(shipment.draftNf)} onChange={handleChange} placeholder="dd/mm/yyyy" /></div>

                        <div className="form-group"><label>Approved Draft NF Date</label><input type="text" name="approvedDraftNf" value={toDisplayDate(shipment.approvedDraftNf)} onChange={handleChange} placeholder="dd/mm/yyyy" /></div>

                        <div className="form-group"><label>NF Nacionalization</label><input type="text" name="nfNacionalization" value={shipment.nfNacionalization || ''} onChange={handleChange} /></div>

                        <div className="form-group"><label>NF Issue Date</label><input type="text" name="nfIssueDate" value={toDisplayDate(shipment.nfIssueDate)} onChange={handleChange} placeholder="dd/mm/yyyy" /></div>

                        <div className="form-group"><label>NF Value Per Container</label><input type="number" step="0.01" name="nfValuePerContainer" value={shipment.nfValuePerContainer || ''} onChange={handleChange} /></div>

                    </div>

                 </div>

                 

                 <div className="detail-card">

                    <h3>Process &amp; Final Status</h3>

                     <div className="form-grid-3col">

                        <div className="form-group"><label>Technician Responsible - China</label><input type="text" name="technicianResponsibleChina" value={shipment.technicianResponsibleChina || ''} onChange={handleChange} /></div>

                        <div className="form-group"><label>Technician Responsible - Brazil</label><input type="text" name="technicianResponsibleBrazil" value={shipment.technicianResponsibleBrazil || ''} onChange={handleChange} /></div>

                        <div className="form-group"><label>Status</label><select id="status" name="status" value={shipment.status} onChange={handleChange}>{Object.values(ImportStatus).map(s => <option key={s} value={s}>{s}</option>)}</select></div>

                        <div className="form-group"><label>Import Plan</label><input type="text" name="importPlan" value={shipment.importPlan || ''} onChange={handleChange} /></div>

                        <div className="form-group"><label>Import Ledger</label><input type="text" name="importLedger" value={shipment.importLedger || ''} onChange={handleChange} /></div>

                        <div className="form-group"><label>Draft DI Date</label><input type="text" name="draftDi" value={toDisplayDate(shipment.draftDi)} onChange={handleChange} placeholder="dd/mm/yyyy" /></div>

                        <div className="form-group"><label>Approved Draft DI Date</label><input type="text" name="approvedDraftDi" value={toDisplayDate(shipment.approvedDraftDi)} onChange={handleChange} placeholder="dd/mm/yyyy" /></div>

                        <div className="form-group"><label>CE</label><input type="text" name="ce" value={shipment.ce || ''} onChange={handleChange} /></div>

                        <div className="form-group" style={{gridColumn: '1 / -1'}}><label>Observation</label><textarea name="observation" value={shipment.observation || ''} onChange={handleChange} rows={4}></textarea></div>

                    </div>

                 </div>



                <div className="form-actions bottom-actions">

                    <button type="button" className="btn-discard" onClick={onCancel}>Cancel</button>

                    <button type="submit" className="btn-create">Save Shipment</button>

                </div>

             </form>

        </div>

    )

};

  

const ImportDetailPage = ({ importProcess, onBack, onEdit }: { importProcess: Shipment, onBack: () => void, onEdit: () => void }) => {

    

    const DetailItem = ({ label, value }: {label: string, value: any}) => (

        <div className="detail-item">

            <span className="detail-label">{label}</span>

            <span className="detail-value">{value === undefined || value === null || value === '' ? 'N/A' : String(value)}</span>

        </div>

    );

    

    return (

        <div className="shipment-detail-container">

            <header>

                <button className="back-button" onClick={onBack}><BackIcon /> Back to List</button>

                <div className="page-header">

                    <ImportsIcon />

                    <h1>BL/AWB: {importProcess.blAwb}</h1>

                </div>

                <div className="header-actions">

                     <button className="action-btn edit-btn" onClick={onEdit}><EditIcon /> Edit</button>

                     <button className="action-btn export-btn" onClick={() => exportFUP(importProcess)}><ExportIcon /> Export FUP</button>

                </div>

            </header>

            <div className="detail-content">

                <div className="detail-card">

                    <h3>Core Identifiers</h3>

                    <DetailItem label="BL/AWB" value={importProcess.blAwb} />

                    <DetailItem label="Shipper" value={importProcess.shipper} />

                    <DetailItem label="PO SAP" value={importProcess.poSap} />

                    <DetailItem label="Invoice" value={importProcess.invoice} />

                    <DetailItem label="Status" value={<span className={`status-pill ${getStatusPillClass(importProcess.status)}`}>{importProcess.status}</span>} />

                </div>

                

                <div className="detail-card">

                    <h3>Cargo Details</h3>

                    <DetailItem label="Description" value={importProcess.description} />

                    <DetailItem label="Type of Cargo" value={importProcess.typeOfCargo} />

                    <DetailItem label="Cost Center" value={importProcess.costCenter} />

                    <DetailItem label="Qty Car / Battery" value={importProcess.qtyCarBattery} />

                    <DetailItem label="Batch China" value={importProcess.batchChina} />

                    <DetailItem label="Color" value={importProcess.color} />

                    <DetailItem label="Ex Tariff" value={importProcess.exTariff} />

                    <DetailItem label="Dangerous Goods (DG)" value={importProcess.dg} />

                </div>

                

                 <div className="detail-card">

                    <h3>Logistics & Container</h3>

                    <DetailItem label="Shipment Type" value={importProcess.shipmentType} />

                    <DetailItem label="CBM" value={importProcess.cbm} />

                    <DetailItem label="FCL / LCL" value={`${importProcess.fcl || 0} / ${importProcess.lcl || 0}`} />

                    <DetailItem label="Type Container" value={importProcess.typeContainer} />

                    <DetailItem label="Incoterm" value={importProcess.incoterm} />

                    <DetailItem label="Container Unloaded" value={importProcess.containerUnloaded} />

                    <DetailItem label="Freight Forwarder Destination" value={importProcess.freightForwarderDestination} />

                    <DetailItem label="Shipowner" value={importProcess.shipowner} />

                    <DetailItem label="Voyage" value={importProcess.voyage} />

                    <DetailItem label="Bonded Warehouse" value={importProcess.bondedWarehouse} />

                 </div>

                 

                <div className="detail-card">

                    <h3>Customs & DI Information</h3>

                    <DetailItem label="Broker" value={importProcess.broker} />

                    <DetailItem label="Unique DI" value={importProcess.uniqueDi} />

                    <DetailItem label="LI Nr." value={importProcess.liNr} />

                    <DetailItem label="Status LI" value={importProcess.statusLi} />

                    <DetailItem label="DI" value={importProcess.di} />

                    <DetailItem label="Parametrization" value={importProcess.parametrization} />

                    <DetailItem label="CE" value={importProcess.ce} />

                    <DetailItem label="Damage Report" value={importProcess.damageReport} />

                </div>

  

                <div className="detail-card full-width">

                     <h3>Key Dates & Deadlines</h3>

                     <div className="detail-grid-4col">

                        <DetailItem label="Actual ETD" value={toDisplayDate(importProcess.actualEtd)} />

                        <DetailItem label="Actual ETA" value={toDisplayDate(importProcess.actualEta)} />

                        <DetailItem label="Transit Time (days)" value={importProcess.transitTime} />

                        <DetailItem label="IE Sent to Broker" value={toDisplayDate(importProcess.ieSentToBroker)} />

                        <DetailItem label="Free Time (days)" value={importProcess.freeTime} />

                        <DetailItem label="Free Time Deadline" value={toDisplayDate(importProcess.freeTimeDeadline)} />

                        <DetailItem label="Storage Deadline" value={toDisplayDate(importProcess.storageDeadline)} />

                        <DetailItem label="Cargo Presence Date" value={toDisplayDate(importProcess.cargoPresenceDate)} />

                        <DetailItem label="DI Registration Date" value={toDisplayDate(importProcess.diRegistrationDate)} />

                        <DetailItem label="Green Channel / Delivery Auth." value={toDisplayDate(importProcess.greenChannelOrDeliveryAuthorizedDate)} />

                        <DetailItem label="Cargo Ready Date" value={toDisplayDate(importProcess.cargoReady)} />

                        <DetailItem label="Invoice Payment Date" value={toDisplayDate(importProcess.invoicePaymentDate)} />

                        <DetailItem label="First Truck Delivery" value={toDisplayDate(importProcess.firstTruckDelivery)} />

                        <DetailItem label="Last Truck Delivery" value={toDisplayDate(importProcess.lastTruckDelivery)} />

                    </div>

                </div>

  

                <div className="detail-card full-width">

                    <h3>Financial & NF Details</h3>

                    <div className="detail-grid-4col">

                        <DetailItem label="Invoice Currency" value={importProcess.invoiceCurrency} />

                        <DetailItem label="Invoice Value" value={formatCurrency(importProcess.invoiceValue, importProcess.invoiceCurrency)} />

                        <DetailItem label="Freight Currency" value={importProcess.freightCurrency} />

                        <DetailItem label="Freight Value" value={formatCurrency(importProcess.freightValue, importProcess.freightCurrency)} />

                        <DetailItem label="VLMD" value={importProcess.vlmd} />

                        <DetailItem label="Tax Rate CNY" value={importProcess.taxRateCny} />

                        <DetailItem label="Tax Rate USD" value={importProcess.taxRateUsd} />

                        <DetailItem label="CIF DI" value={importProcess.cifDi} />

                        <DetailItem label="NF Nacionalization" value={importProcess.nfNacionalization} />

                        <DetailItem label="NF Issue Date" value={toDisplayDate(importProcess.nfIssueDate)} />

                        <DetailItem label="NF Value Per Container" value={formatCurrency(importProcess.nfValuePerContainer)} />

                        <DetailItem label="Draft NF Date" value={toDisplayDate(importProcess.draftNf)} />

                        <DetailItem label="Approved Draft NF Date" value={toDisplayDate(importProcess.approvedDraftNf)} />

                    </div>

                </div>

  

                <div className="detail-card full-width">

                    <h3>Process, Team & Observations</h3>

                     <div className="detail-grid-4col">

                        <DetailItem label="Import Plan" value={importProcess.importPlan} />

                        <DetailItem label="Import Ledger" value={importProcess.importLedger} />

                        <DetailItem label="Draft DI Date" value={toDisplayDate(importProcess.draftDi)} />

                        <DetailItem label="Approved Draft DI Date" value={toDisplayDate(importProcess.approvedDraftDi)} />

                        <DetailItem label="Under Water" value={importProcess.underWater} />

                        <DetailItem label="Technician - China" value={importProcess.technicianResponsibleChina} />

                        <DetailItem label="Technician - Brazil" value={importProcess.technicianResponsibleBrazil} />

                    </div>

                   {importProcess.observation && (

                        <>

                            <hr style={{margin: '1rem 0', border: 'none', borderTop: '1px solid var(--border-color)'}}/>

                            <div className="detail-item">

                                <span className="detail-label">Observation</span>

                            </div>

                            <p style={{whiteSpace: 'pre-wrap', color: 'var(--text-dark)', marginTop: '-0.5rem'}}>{importProcess.observation}</p>

                        </>

                   )}

                </div>

            </div>

        </div>

    );

};

  

const FUPReportPage = ({ shipments }: { shipments: Shipment[] }) => {

    const [searchTerm, setSearchTerm] = useState('');

  

    const filteredShipments = useMemo(() => {

        if (!searchTerm) return shipments;

        const lowercasedFilter = searchTerm.toLowerCase();

        return shipments.filter(imp =>

            Object.values(imp).some(value =>

                String(value).toLowerCase().includes(lowercasedFilter)

            )

        );

    }, [shipments, searchTerm]);

  

    const headers = orderedShipmentColumns.map(c => c.header);

  

    return (

        <div className="fup-report-page">

             <div className="table-wrapper">

                <div className="table-header">

                    <h2>Relatório FUP</h2>

                    <div className="table-actions">

                        <input

                            type="text"

                            placeholder="Search all fields..."

                            className="search-bar"

                            value={searchTerm}

                            onChange={(e) => setSearchTerm(e.target.value)}

                        />

                        <button onClick={() => exportAllToXLSX(filteredShipments, 'fup_report.xlsx')} className="new-import-btn">

                            <ExportIcon /> Export XLSX

                        </button>

                    </div>

                </div>

                <div className="table-container">

                    <table className="shipments-table">

                        <thead>

                            <tr>

                                {headers.map(h => <th key={h}>{h}</th>)}

                            </tr>

                        </thead>

                        <tbody>

                            {filteredShipments.map(imp => (

                                <tr key={imp.id}>

                                    {orderedShipmentColumns.map(col => {

                                        const key = col.key;

                                        const value = imp[key as keyof Shipment];

                                        const isWrappable = key === 'description' || key === 'observation';

                                        const tdClassName = isWrappable ? 'wrap-text' : '';

  

                                        let cellContent: React.ReactNode;

  

                                        if (Array.isArray(value)) {

                                            cellContent = `${value.length} items`;

                                        } else if (typeof value === 'object' && value !== null) {

                                            cellContent = '[Object Data]';

                                        } else if (key === 'status') {

                                            cellContent = <span className={`status-pill ${getStatusPillClass(value as ImportStatus)}`}>{value as string}</span>;

                                        } else if (key === 'invoiceValue') {

                                            cellContent = typeof value === 'number' ? formatCurrency(value, imp.invoiceCurrency) : '';

                                        } else {

                                            cellContent = value === null || value === undefined ? '' : String(value);

                                        }

  

                                        return <td key={key} className={tdClassName}>{cellContent}</td>;

                                    })}

                                </tr>

                            ))}

                        </tbody>

                    </table>

                </div>

            </div>

        </div>

    );

};

  

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

  

const FiveW2HPage = ({ data, onSave, onDelete, allImports, allUsers }: { data: FiveW2H[], onSave: (item: FiveW2H) => void, onDelete: (id: string) => void, allImports: Shipment[], allUsers: User[] }) => {

    const [searchTerm, setSearchTerm] = useState('');

    const [statusFilter, setStatusFilter] = useState('All');

    const [isModalOpen, setIsModalOpen] = useState(false);

    const [editingItem, setEditingItem] = useState<FiveW2H | undefined>(undefined);

  

    const handleNew = () => {

        setEditingItem(undefined);

        setIsModalOpen(true);

    };

  

    const handleEdit = (item: FiveW2H) => {

        setEditingItem(item);

        setIsModalOpen(true);

    };

  

    const handleSave = (item: FiveW2H) => {

        onSave(item);

        setIsModalOpen(false);

        setEditingItem(undefined);

    };

  

    const filteredData = useMemo(() => {

        return data.filter(item => {

            const matchesSearch = searchTerm === '' ||

                item.what.toLowerCase().includes(searchTerm.toLowerCase()) ||

                item.who.toLowerCase().includes(searchTerm.toLowerCase()) ||

                item.relatedTo?.label.toLowerCase().includes(searchTerm.toLowerCase());

            

            const matchesStatus = statusFilter === 'All' || item.status === statusFilter;

  

            return matchesSearch && matchesStatus;

        });

    }, [data, searchTerm, statusFilter]);

  

    return (

        <div className="fivew2h-page">

            <div className="table-wrapper">

                <div className="table-header">

                    <h2>5W2H Action Plan</h2>

                    <div className="table-actions">

                        <input

                            type="text"

                            placeholder="Search actions..."

                            className="search-bar"

                            value={searchTerm}

                            onChange={e => setSearchTerm(e.target.value)}

                        />

                         <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="status-filter">

                            <option value="All">All Statuses</option>

                            {Object.values(FiveW2HStatus).map(s => <option key={s} value={s}>{s}</option>)}

                        </select>

                        <button onClick={handleNew} className="new-import-btn">New Action</button>

                    </div>

                </div>

                <div className="table-container">

                    <table className="shipments-table">

                        <thead>

                            <tr>

                                <th>What</th>

                                <th>Who</th>

                                <th>When (Due)</th>

                                <th>Related To</th>

                                <th>Status</th>

                                <th>Actions</th>

                            </tr>

                        </thead>

                        <tbody>

                            {filteredData.map(item => (

                                <tr key={item.id}>

                                    <td style={{whiteSpace: 'normal'}}>{item.what}</td>

                                    <td>{item.who}</td>

                                    <td>{item.when}</td>

                                    <td>{item.relatedTo?.label || 'N/A'}</td>

                                    <td><span className={`status-pill ${get5W2HStatusPillClass(item.status)}`}>{item.status}</span></td>

                                    <td className="actions-cell">

                                        <button className="action-btn edit-btn" onClick={() => handleEdit(item)}><EditIcon /></button>

                                        <button className="action-btn delete-btn" onClick={() => onDelete(item.id)}><TrashIcon /></button>

                                    </td>

                                </tr>

                            ))}

                        </tbody>

                    </table>

                </div>

            </div>

            {isModalOpen && (

                <FiveW2HFormModal 

                    item={editingItem} 

                    onSave={handleSave} 

                    onCancel={() => setIsModalOpen(false)}

                    allImports={allImports}

                    allUsers={allUsers}

                />

            )}

        </div>

    );

};

  

const AdminPage = ({ user, onPasswordChange }: { user: User, onPasswordChange: (pass: string) => void }) => {

    const [password, setPassword] = useState('');

    const [confirmPassword, setConfirmPassword] = useState('');

    const [error, setError] = useState('');

    const [success, setSuccess] = useState('');

  

    const handleSubmit = (e: React.FormEvent) => {

        e.preventDefault();

        setError('');

        setSuccess('');

  

        if (!password || !confirmPassword) {

            setError('Please fill out both password fields.');

            return;

        }

        if (password !== confirmPassword) {

            setError('Passwords do not match.');

            return;

        }

        if (password.length < 6) {

            setError('Password must be at least 6 characters long.');

            return;

        }

  

        onPasswordChange(password);

        setSuccess('Password changed successfully!');

        setPassword('');

        setConfirmPassword('');

    };

  

    return (

        <div className="admin-page">

             <header>

                <h1>Admin Settings</h1>

            </header>

            <div className="password-change-card">

                <h3>Change My Password</h3>

                <p>Update the password for your account ({user.username}).</p>

                <form onSubmit={handleSubmit}>

                     {error && <div className="error-banner"><AlertCircleIcon /> {error}</div>}

                     {success && <div className="success-banner"><CheckCircleIcon /> {success}</div>}

                     <div className="form-group">

                        <label htmlFor="newPassword">New Password</label>

                        <input

                            id="newPassword"

                            type="password"

                            value={password}

                            onChange={(e) => setPassword(e.target.value)}

                        />

                    </div>

                     <div className="form-group">

                        <label htmlFor="confirmNewPassword">Confirm New Password</label>

                        <input

                            id="confirmNewPassword"

                            type="password"

                            value={confirmPassword}

                            onChange={(e) => setConfirmPassword(e.target.value)}

                        />

                    </div>

                    <div className="form-actions bottom-actions">

                        <button type="submit" className="btn-create">Update Password</button>

                    </div>

                </form>

            </div>

        </div>

    );

};

  

const LoginScreen = ({ onLogin, error }: { onLogin: (username: string, pass: string) => void, error: string }) => {

    const [username, setUsername] = useState('');

    const [password, setPassword] = useState('');

  

    const handleSubmit = (e: React.FormEvent) => {

        e.preventDefault();

        onLogin(username, password);

    };

  

    return (

        <div className="login-screen">

            <div className="login-box animate-scale-in">

                <div className="login-header">

                    <h1 className="byd-title">BYD Navigator</h1>

                </div>

                <p className="login-subtitle">Please enter your credentials to continue</p>

                <form onSubmit={handleSubmit}>

                     <div className="form-group">

                        <label htmlFor="username">Username</label>

                        <input

                            id="username"

                            type="text"

                            value={username}

                            onChange={(e) => setUsername(e.target.value)}

                            autoFocus

                            required

                        />

                    </div>

                    <div className="form-group">

                        <label htmlFor="password">Password</label>

                        <input

                            id="password"

                            type="password"

                            value={password}

                            onChange={(e) => setPassword(e.target.value)}

                            required

                        />

                    </div>

                    {error && <p className="login-error">{error}</p>}

                    <button type="submit" className="btn-create login-btn">Login</button>

                </form>

            </div>

        </div>

    );

};

  

const UserFormModal = ({ user, onSave, onCancel }: { user?: User, onSave: (user: User) => void, onCancel: () => void }) => {

    const [formData, setFormData] = useState<User>(user || { id: '', name: '', username: '', role: 'Broker', password: '' });

    const [confirmPassword, setConfirmPassword] = useState('');

    const [error, setError] = useState('');

  

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {

        const { name, value } = e.target;

        setFormData(prev => ({ ...prev, [name]: value }));

    };

  

    const handleSubmit = (e: React.FormEvent) => {

        e.preventDefault();

        setError('');

  

        if (formData.password !== confirmPassword) {

            setError('Passwords do not match.');

            return;

        }

  

        if (!formData.id && !formData.password) {

            setError('Password is required for new users.');

            return;

        }

  

        onSave(formData);

    };

  

    const roles: UserRole[] = ['Admin', 'COMEX', 'Broker', 'Logistics', 'Finance'];

  

    return (

        <div className="modal-overlay animate-fade-in" onClick={onCancel}>

            <div className="modal-content animate-scale-in" onClick={e => e.stopPropagation()}>

                <form onSubmit={handleSubmit}>

                    <div className="modal-header">

                        <h3 className="modal-title">{user ? 'Edit User' : 'New User'}</h3>

                        <button type="button" onClick={onCancel} className="close-button"><CloseIcon /></button>

                    </div>

                    <div className="modal-body">

                        {error && <div className="error-banner"><AlertCircleIcon /> {error}</div>}

                        <div className="form-group">

                            <label htmlFor="name">Full Name</label>

                            <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} required />

                        </div>

                        <div className="form-group">

                            <label htmlFor="username">Username</label>

                            <input type="text" id="username" name="username" value={formData.username} onChange={handleChange} required readOnly={!!user} />

                        </div>

                        <div className="form-group">

                            <label htmlFor="role">Role</label>

                            <select id="role" name="role" value={formData.role} onChange={handleChange}>

                                {roles.map(r => <option key={r} value={r}>{r}</option>)}

                            </select>

                        </div>

                         <div className="form-group">

                            <label htmlFor="password">{user ? 'New Password' : 'Password'}</label>

                            <input type="password" id="password" name="password" value={formData.password} onChange={handleChange} placeholder={user ? 'Leave blank to keep current' : ''} />

                        </div>

                        <div className="form-group">

                            <label htmlFor="confirmPassword">Confirm Password</label>

                            <input type="password" id="confirmPassword" name="confirmPassword" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />

                        </div>

                    </div>

                    <div className="modal-actions-footer">

                        <button type="button" onClick={onCancel} className="btn-discard">Cancel</button>

                        <button type="submit" className="btn-create">{user ? 'Save Changes' : 'Create User'}</button>

                    </div>

                </form>

            </div>

        </div>

    );

};

  

const TeamPage = ({ users, onSave, onDelete }: { users: User[], onSave: (user: User) => void, onDelete: (id: string) => void }) => {

    const [isModalOpen, setIsModalOpen] = useState(false);

    const [editingUser, setEditingUser] = useState<User | undefined>(undefined);

  

    const handleNew = () => {

        setEditingUser(undefined);

        setIsModalOpen(true);

    };

  

    const handleEdit = (user: User) => {

        setEditingUser(user);

        setIsModalOpen(true);

    };

  

    const handleSave = (user: User) => {

        onSave(user);

        setIsModalOpen(false);

        setEditingUser(undefined);

    };

  

    return (

        <div className="team-page">

            <div className="table-wrapper">

                <div className="table-header">

                    <h2>User Management</h2>

                    <div className="table-actions">

                        <button onClick={handleNew} className="new-import-btn">New User</button>

                    </div>

                </div>

                <div className="table-container">

                    <table className="shipments-table">

                        <thead>

                            <tr>

                                <th>Name</th>

                                <th>Role</th>

                                <th>Actions</th>

                            </tr>

                        </thead>

                        <tbody>

                            {users.map(user => (

                                <tr key={user.id}>

                                    <td>{user.name}</td>

                                    <td>{user.role}</td>

                                    <td className="actions-cell">

                                        <button className="action-btn edit-btn" onClick={() => handleEdit(user)}><EditIcon /></button>

                                        <button className="action-btn delete-btn" onClick={() => onDelete(user.id)}><TrashIcon /></button>

                                    </td>

                                </tr>

                            ))}

                        </tbody>

                    </table>

                </div>

            </div>

            {isModalOpen && (

                <UserFormModal 

                    user={editingUser} 

                    onSave={handleSave} 

                    onCancel={() => setIsModalOpen(false)}

                />

            )}

        </div>

    );

};

  

type AccordionItemProps = {

    title: string;

    isOpen: boolean;

    onToggle: () => void;

    children: React.ReactNode;

};



const AccordionItem: React.FC<AccordionItemProps> = ({ title, children, isOpen, onToggle }) => (

    <div className="accordion-item">

        <button className="accordion-header" onClick={onToggle} aria-expanded={isOpen}>

            <span className="accordion-title">{title}</span>

            <span className={`accordion-icon ${isOpen ? 'open' : ''}`}><ChevronDownIcon /></span>

        </button>

        <div className={`accordion-content ${isOpen ? 'open' : ''}`}>

            <div className="accordion-content-inner">

                {children}

            </div>

        </div>

    </div>

);

  

const UploadModal = ({ onCancel, onImport, parser, title }: { onCancel: () => void, onImport: (data: any[]) => void, parser: (data: any[]) => { data: any[], error: string | null }, title: string }) => {

    const [dragOver, setDragOver] = useState(false);

    const [fileName, setFileName] = useState<string | null>(null);

    const [error, setError] = useState<string | null>(null);

    const [parsedData, setParsedData] = useState<any[] | null>(null);

    

    const processFile = (file: File) => {

        setFileName(file.name);

        setError(null);

        setParsedData(null);

        

        const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

        const validExtensions = ['.csv', '.xls', '.xlsx'];

  

        if (!validExtensions.includes(fileExtension)) {

            setError("Invalid file type. Please upload a .csv, .xls, or .xlsx file.");

            return;

        }

  

        const reader = new FileReader();

        reader.onload = (e) => {

            try {

                let jsonData: any[] = [];

                if (fileExtension === '.csv') {

                    const text = e.target?.result as string;

                    const lines = text.trim().split(/\r?\n/);

                    if (lines.length < 2) throw new Error("CSV must have a header and at least one data row.");

                    

                    const headers = lines[0].split(',').map(h => h.trim());

                    jsonData = lines.slice(1).map(line => {

                        const values = line.split(',');

                        const obj: { [key: string]: string } = {};

                        headers.forEach((header, i) => {

                            obj[header] = values[i] ? values[i].trim() : '';

                        });

                        return obj;

                    });

                } else { // Excel file

                    const data = e.target?.result as ArrayBuffer;

                    const workbook = XLSX.read(data, { type: 'array' });

                    const firstSheetName = workbook.SheetNames[0];

                    if (!firstSheetName) throw new Error("No sheets found in the Excel file.");

                    const worksheet = workbook.Sheets[firstSheetName];

                    

                    const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

                    if (rows.length === 0) throw new Error("Sheet is empty.");

  

                    const expectedHeaders = new Set(orderedShipmentColumns.map(c => normalizeHeader(c.header)));

                    let headerRowIndex = -1;

                    let headers: string[] = [];

                    

                    for (let i = 0; i < Math.min(rows.length, 10); i++) {

                        const row = rows[i];

                        if (!Array.isArray(row)) continue;

                        

                        const potentialHeaders = row.map(cell => String(cell || '').trim());

                        let matchCount = 0;

                        potentialHeaders.forEach(h => {

                            if (expectedHeaders.has(normalizeHeader(h))) {

                                matchCount++;

                            }

                        });

  

                        if (matchCount > 3) { // Threshold for considering it a header row

                            headerRowIndex = i;

                            headers = potentialHeaders;

                            break;

                        }

                    }

  

                    if (headerRowIndex === -1) {

                        throw new Error("Could not automatically detect the header row. Please ensure columns like 'SHIPPER', 'BL/AWB', 'INVOICE' are present near the top of your file.");

                    }

                    

                    const dataRows = rows.slice(headerRowIndex + 1);

                    jsonData = dataRows.map(row => {

                        const obj: { [key: string]: any } = {};

                        if (!Array.isArray(row)) return null;

                        

                        headers.forEach((header, i) => {

                            if (header) {

                                obj[header] = row[i];

                            }

                        });

                        return obj;

                    }).filter(obj => obj && Object.values(obj).some(val => val !== null && String(val).trim() !== ''));

                }

  

                const result = parser(jsonData);

                if (result.error) {

                    setError(result.error);

                } else {

                    setParsedData(result.data);

                }

            } catch (err: any) {

                setError(err.message || "Failed to process the file.");

                setParsedData(null);

            }

        };

        reader.onerror = () => {

             setError("Failed to read the file.");

        };

  

        if (fileExtension === '.csv') {

            reader.readAsText(file);

        } else {

            reader.readAsArrayBuffer(file);

        }

    };

  

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {

        if (e.target.files && e.target.files.length > 0) {

            processFile(e.target.files[0]);

        }

    };

  

    const handleDrop = (e: React.DragEvent) => {

        e.preventDefault();

        setDragOver(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {

            processFile(e.dataTransfer.files[0]);

            e.dataTransfer.clearData();

        }

    };

    

    return (

        <div className="modal-overlay animate-fade-in" onClick={onCancel}>

            <div className="modal-content modal-content-large animate-scale-in" onClick={e => e.stopPropagation()}>

                <div className="modal-header">

                    <h3 className="modal-title">{title}</h3>

                    <button type="button" onClick={onCancel} className="close-button"><CloseIcon /></button>

                </div>

                <div className="modal-body">

                    {!parsedData && (

                        <div 

                            className={`drop-zone ${dragOver ? 'drag-over' : ''}`}

                            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}

                            onDragLeave={() => setDragOver(false)}

                            onDrop={handleDrop}

                        >

                            <input type="file" id="file-upload" accept=".csv,.xls,.xlsx" onChange={handleFileSelect} hidden />

                            <label htmlFor="file-upload" className="upload-label">

                                <UploadIcon />

                                <span>{fileName || 'Drag & drop a .csv, .xls, or .xlsx file here, or click to select'}</span>

                            </label>

                        </div>

                    )}

  

                    {error && <div className="error-banner"><AlertCircleIcon /> {error}</div>}

  

                    {parsedData && (

                        <div className="upload-preview">

                            <h4>Import Preview</h4>

                            <p>Found {parsedData.length} records in <strong>{fileName}</strong>. Records with existing identifiers will be updated.</p>

                            <div className="preview-table-container">

                                <table className="shipments-table simple-table">

                                    <thead><tr><th>BL/AWB</th><th>Shipper</th><th>Description</th><th>Status</th></tr></thead>

                                    <tbody>

                                        {parsedData.slice(0, 5).map(item => (

                                            <tr key={item.blAwb}>

                                                <td>{item.blAwb}</td>

                                                <td>{item.shipper || 'N/A'}</td>

                                                <td>{item.description || 'N/A'}</td>

                                                <td>{item.status || 'N/A'}</td>

                                            </tr>

                                        ))}

                                    </tbody>

                                </table>

                                {parsedData.length > 5 && <p className="preview-more-info">...and {parsedData.length - 5} more rows.</p>}

                            </div>

                        </div>

                    )}

                </div>

                <div className="modal-actions-footer">

                    <button type="button" onClick={onCancel} className="btn-discard">Cancel</button>

                    <button type="button" onClick={() => onImport(parsedData!)} className="btn-create" disabled={!parsedData || !!error}>

                        Confirm Import

                    </button>

                </div>

            </div>

        </div>

    );

};

  

const ConfirmationModal = ({ title, message, onConfirm, onCancel, confirmText = 'Confirm', cancelText = 'Cancel' }: { title: string, message: string, onConfirm: () => void, onCancel: () => void, confirmText?: string, cancelText?: string }) => {

    return (

        <div className="modal-overlay animate-fade-in">

            <div className="modal-content animate-scale-in" style={{ maxWidth: '450px' }}>

                <div className="modal-header">

                    <h3 className="modal-title">{title}</h3>

                    <button type="button" onClick={onCancel} className="close-button"><CloseIcon /></button>

                </div>

                <div className="modal-body">

                    <p>{message}</p>

                </div>

                <div className="modal-actions-footer">

                    <button type="button" onClick={onCancel} className="btn-discard">{cancelText}</button>

                    <button type="button" onClick={onConfirm} className="btn-create" style={{ backgroundColor: 'var(--status-red)' }}>{confirmText}</button>

                </div>

            </div>

        </div>

    );

};





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

    const isInitialLoad = useRef(true);

    

    // --- ESTADO DE AUTENTICAÇÃO ---

    const [loggedInUser, setLoggedInUser] = useState<User | null>(null);

    const [loginError, setLoginError] = useState('');

    

    // --- ESTADO DE NAVEGAÇÃO ---

    const [currentView, setCurrentView] = useState('dashboard');

    const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);

    const [initialImportFilter, setInitialImportFilter] = useState<{ type: string, value: string } | null>(null);



    // --- ESTADO DO MODAL DE CONFIRMAÇÃO ---

    const [shipmentToDeleteId, setShipmentToDeleteId] = useState<string | null>(null);



    // ADICIONADO: Efeito para carregar dados do Firebase na inicialização

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

                console.log("Nenhum dado encontrado no Firebase, usando dados iniciais.");

                // Se o documento não existe, usamos os dados mock e salvamos para criar

                setShipments([]);

                setUsers(initialUsers);

                setClaims([]);

                setTasks([]);

                setExchangeRates(initialExchangeRates);

                setFiveW2HData([]);

            }

            setIsLoading(false);

            isInitialLoad.current = false;

        }, (error: any) => {

            console.error("Erro ao ouvir o Firebase:", error);

            setIsLoading(false);

        });



        // Limpa o listener quando o componente é desmontado

        return () => unsubscribe();

    }, []);



    // ADICIONADO: Efeito para salvar o estado no Firebase sempre que ele mudar

    useEffect(() => {

        // Não salva na carga inicial, pois acabamos de receber os dados

        if (isInitialLoad.current) return;



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



    }, [shipments, users, claims, tasks, exchangeRates, fiveW2HData]);





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

// ... (função parseGeneralShipmentFile permanece aqui)

const parseGeneralShipmentFile = (jsonData: any[]): { data: Shipment[], error: string | null } => {

    try {

        if (jsonData.length === 0) {

            return { data: [], error: "File contains no data rows." };

        }

        

        const firstRow = jsonData[0];

        if (!firstRow) {

            return { data: [], error: "File seems to be empty or malformed." };

        }



        const rawHeaders = Object.keys(firstRow);

        const headerNormalizationMap = new Map<string, string>(); // Maps normalized header to raw header

        rawHeaders.forEach(h => headerNormalizationMap.set(normalizeHeader(h), h));

        

        const blAwbAliases = ['blawb', 'bl', 'awb'];

        let blAwbRawHeader: string | undefined;



        for (const alias of blAwbAliases) {

            if (headerNormalizationMap.has(alias)) {

                blAwbRawHeader = headerNormalizationMap.get(alias);

                break;

            }

        }

        

        if (!blAwbRawHeader) {

            const foundHeaders = rawHeaders.length > 0 ? rawHeaders.join(', ') : 'none';

            return { 

                data: [], 

                error: `Missing required identifier column. Please ensure your file has a column named 'BL/AWB', 'BL', or 'AWB'. Found headers: ${foundHeaders}`

            };

        }

        

        const headerToKeyMap: { [key: string]: keyof Shipment } = {

            'shipper': 'shipper', 'posap': 'poSap', 'invoice': 'invoice',

            'description': 'description', 'typeofcargo': 'typeOfCargo', 'costcenter': 'costCenter',

            'qtycarbattery': 'qtyCarBattery', 'batchchina': 'batchChina', 'color': 'color',

            'extariff': 'exTariff', 'uniquedi': 'uniqueDi', 'linr': 'liNr', 'statusli': 'statusLi',

            'dg': 'dg', 'underwater': 'underWater',

            'technicianresponsiblechinateam': 'technicianResponsibleChina',

            'technicianresponsiblebrazil': 'technicianResponsibleBrazil',

            'shipmenttype': 'shipmentType', 'cbm': 'cbm', 'fcl': 'fcl', 'lcl': 'lcl',

            'typecontainer': 'typeContainer', 'incoterm': 'incoterm', 'containerunloaded': 'containerUnloaded',

            'freightforwaderdestination': 'freightForwarderDestination', 'broker': 'broker',

            'iesenttobroker': 'ieSentToBroker', 'shipowner': 'shipowner', 'freetime': 'freeTime',

            'freetimedeadline': 'freeTimeDeadline', 'arrivalvessel': 'arrivalVessel', 'voyage': 'voyage',

            'bondedwarehouse': 'bondedWarehouse', 'invoicecurrency': 'invoiceCurrency',

            'invoicevalue': 'invoiceValue', 'freightcurrency': 'freightCurrency',

            'freightvalue': 'freightValue', 'typeofinspection': 'typeOfInspection',

            'qtycontainerinspection': 'qtyContainerInspection', 'additionalservices': 'additionalServices',

            'importplan': 'importPlan', 'importledger': 'importLedger', 'draftdi': 'draftDi',

            'approveddraftdi': 'approvedDraftDi', 'actualetd': 'actualEtd', 'actualeta': 'actualEta',

            'transittime': 'transitTime', 'storagedeadline': 'storageDeadline', 'ce': 'ce',

            'cargopresencedate': 'cargoPresenceDate', 'damagereport': 'damageReport', 'di': 'di',

            'diregistrationdate': 'diRegistrationDate', 'parametrization': 'parametrization',

            'greenchannelordeliveryauthorizeddate': 'greenChannelOrDeliveryAuthorizedDate', 'vlmd': 'vlmd',

            'taxratecny': 'taxRateCny', 'taxrateusd': 'taxRateUsd', 'cifdi': 'cifDi', 'draftnf': 'draftNf',

            'approveddraftnf': 'approvedDraftNf', 'nfnacionalization': 'nfNacionalization',

            'nfissuedate': 'nfIssueDate', 'nfvaluepercontainer': 'nfValuePerContainer',

            'cargoready': 'cargoReady', 'firsttruckdelivery': 'firstTruckDelivery',

            'lasttruckdelivery': 'lastTruckDelivery', 'invoicepaymentdate': 'invoicePaymentDate',

            'status': 'status', 'observation': 'observation',

        };



        const shipments: Shipment[] = [];

        for (const row of jsonData) {

            const blAwbValue = row[blAwbRawHeader];



            if (!blAwbValue || String(blAwbValue).trim() === '') {

                continue; 

            }

            

            const newShipment: Partial<Shipment> = {

                blAwb: String(blAwbValue).trim(),

                id: uuidv4(), // Assign a new ID for every row from file

            };



            for (const rawHeader in row) {

                if (rawHeader === blAwbRawHeader) continue;



                const value = row[rawHeader];

                const normalizedHeader = normalizeHeader(rawHeader);

                const key = headerToKeyMap[normalizedHeader];

                if (key) {

                    (newShipment as any)[key] = value !== null && value !== '' ? value : undefined;

                }

            }

            

            const numberFields: (keyof Shipment)[] = ['qtyCarBattery', 'cbm', 'fcl', 'lcl', 'containerUnloaded', 'freeTime', 'invoiceValue', 'freightValue', 'qtyContainerInspection', 'transitTime', 'taxRateCny', 'taxRateUsd', 'nfValuePerContainer'];

            numberFields.forEach(field => {

                if (newShipment[field] !== undefined) {

                    const val = newShipment[field];

                    const numVal = parseFloat(String(val).replace(/[^0-9.,-]/g, '').replace(',', '.'));

                    (newShipment as any)[field] = isNaN(numVal) ? undefined : numVal;

                }

            });



            const dateFields: (keyof Shipment)[] = ['ieSentToBroker', 'freeTimeDeadline', 'draftDi', 'approvedDraftDi', 'actualEtd', 'actualEta', 'storageDeadline', 'cargoPresenceDate', 'diRegistrationDate', 'greenChannelOrDeliveryAuthorizedDate', 'draftNf', 'approvedDraftNf', 'nfIssueDate', 'cargoReady', 'firstTruckDelivery', 'lastTruckDelivery', 'invoicePaymentDate'];

            dateFields.forEach(field => {

                const value = newShipment[field];

                if (value === undefined || value === null || value === '') {

                    (newShipment as any)[field] = undefined;

                    return;

                }



                let isoString: string | undefined = undefined;



                if (typeof value === 'number') {

                    const d = XLSX.SSF.parse_date_code(value);

                    if (d) {

                        const date = new Date(Date.UTC(d.y, d.m - 1, d.d));

                        if (!isNaN(date.getTime())) {

                            isoString = date.toISOString().split('T')[0];

                        }

                    }

                } else if (typeof value === 'string') {

                    const dateStr = value.trim();

                    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) { // DD/MM/YYYY

                        const [d, m, y] = dateStr.split('/');

                        isoString = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;

                    } else {

                        isoString = dateStr;

                    }

                }

                (newShipment as any)[field] = isoString;

            });

            

            const statusValue = String(newShipment.status || '').toUpperCase();

            newShipment.status = Object.values(ImportStatus).includes(statusValue as ImportStatus)

                ? statusValue as ImportStatus

                : ImportStatus.OrderPlaced;



            shipments.push({

                containers: [], costs: [], ...newShipment

            } as Shipment);

        }

        

         if (shipments.length === 0 && jsonData.length > 0) {

            return { data: [], error: "No valid data rows with an identifier ('BL/AWB', 'BL', or 'AWB') could be found. Please check your file." };

        }



        return { data: shipments, error: null };

    } catch (e: any) {

       return { data: [], error: e.message || "An unknown parsing error occurred." };

    }

};



// --- RENDERIZAÇÃO INICIAL DA APP ---

const container = document.getElementById('root');

const root = createRoot(container!);

root.render(<App />);
