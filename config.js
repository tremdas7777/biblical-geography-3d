/**
 * Configuracao da oferta - edite so este arquivo.
 *
 * IMPORTANTE: o checkout e os pixels do funil original foram removidos.
 * Se voce publicar sem trocar por dados seus, as vendas e os dados de
 * trafego vao para o dono da oferta original.
 */
window.FUNNEL_CONFIG = {
  // Link do seu checkout (Hotmart, Kiwify, Stripe, PayPal, Digistore24...)
  // Ex.: "https://pay.hotmart.com/SEU_PRODUTO?checkoutMode=10"
  checkoutUrl: "https://checkout.kashpay.com.br/checkout/checkout-1787280030198",

  // Pixels de rastreamento (deixe vazio para nao carregar)
  metaPixelId: "",   // ex.: "1234567890123456"
  gtagId: "",        // ex.: "G-XXXXXXXXXX"

  // Contagem regressiva da oferta, em horas
  countdownHours: 24,

  // API Node local/Render (vazio = tenta Supabase ou mesmo domínio)
  analyticsApi: "",

  // Lovable Cloud / Supabase (obtenha em Settings → Cloud no Lovable)
  supabaseUrl: "",
  supabaseAnonKey: "",

  // E-mail do usuário admin criado no Supabase Auth
  adminEmail: "admin@thebiblicalgeography.com"
};
