export const dashboardStats = [
  { label: "Clientes registrados", value: "1.248", change: "+8,2%", tone: "blue" },
  { label: "Visitas este mes", value: "3.920", change: "+12,4%", tone: "blue" },
  { label: "Recompensas redimidas", value: "342", change: "+5,1%", tone: "green" },
  { label: "Créditos entregados", value: "$1.860.000", change: "+18,0%", tone: "amber" }
];

export const customers = [
  { name: "María González", initials: "MG", visits: 18, points: 820, status: "VIP", last: "Hace 5 min", spent: "$420.000" },
  { name: "Carlos Ruiz", initials: "CR", visits: 9, points: 340, status: "Activo", last: "Hace 22 min", spent: "$186.000" },
  { name: "Ana Martínez", initials: "AM", visits: 12, points: 510, status: "MiniPay", last: "Hace 1 h", spent: "$260.000" },
  { name: "Diego Torres", initials: "DT", visits: 2, points: 40, status: "Nuevo", last: "Hace 2 h", spent: "$34.000" },
  { name: "Laura Pérez", initials: "LP", visits: 7, points: 280, status: "Referidor", last: "Hace 3 h", spent: "$128.000" },
  { name: "Jorge Castro", initials: "JC", visits: 5, points: 160, status: "Activo", last: "Hace 4 h", spent: "$91.000" }
];

export const recentActivity = [
  ["María González", "MG", "Redimió café gratis", "-100", "Hace 5 min"],
  ["Carlos Ruiz", "CR", "Completó misión: Compra 2 veces", "+50", "Hace 22 min"],
  ["Ana Martínez", "AM", "Pagó con MiniPay", "+30", "Hace 1 h"],
  ["Diego Torres", "DT", "Se unió al comercio", "+20", "Hace 2 h"],
  ["Laura Pérez", "LP", "Invitó a un amigo", "+40", "Hace 3 h"],
  ["Jorge Castro", "JC", "Redimió 15% de descuento", "-80", "Hace 4 h"]
];

export const campaigns = [
  { name: "Doble puntos fin de semana", status: "Activa", reach: 820, redemptions: 134, tone: "green" },
  { name: "Café gratis cumpleaños", status: "Activa", reach: 96, redemptions: 41, tone: "green" },
  { name: "Vuelve y gana $5.000", status: "Programada", reach: 0, redemptions: 0, tone: "blue" },
  { name: "Verano 2x1", status: "Finalizada", reach: 1540, redemptions: 287, tone: "slate" }
];

export const rewards = [
  { name: "Café gratis con 10 sellos", type: "Producto gratis", requirement: "10 sellos", redeemed: 128, active: true },
  { name: "15% de descuento", type: "Descuento", requirement: "200 puntos", redeemed: 64, active: true },
  { name: "$5.000 de crédito", type: "Crédito", requirement: "Primera visita", redeemed: 312, active: true },
  { name: "50 puntos de bienvenida", type: "Puntos", requirement: "Registro", redeemed: 540, active: false }
];

export const missions = [
  { name: "Compra 2 veces esta semana", category: "Frecuencia", progress: 64, reward: "+50 puntos", active: true },
  { name: "Invita a un amigo", category: "Referidos", progress: 38, reward: "+40 puntos", active: true },
  { name: "Paga con MiniPay", category: "Pago digital", progress: 22, reward: "+30 puntos", active: true },
  { name: "Visítanos en horario valle", category: "Hora valle", progress: 18, reward: "+25 puntos", active: false }
];

export const chart = [44, 62, 50, 78, 90, 100, 70];
