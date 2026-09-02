// ============================================================================
// TOÀN BỘ NỘI DUNG LANDING PAGE — FILL DATA THẬT VÀO ĐÂY
// Data hiện tại là GIẢ (placeholder). Sửa text / link / ảnh tùy ý.
// ============================================================================

export const site = {
  // --- Thông tin chung / SEO ---
  meta: {
    siteUrl: "https://thelifecar.example.com", // TODO: domain thật
    title: "THE LIFECAR™ — Chiếc Xe Cuộc Đời | Nguyễn Chí Thành",
    description:
      "Cuốn sách xây dựng một cấu trúc sống để tiến xa mà không lạc lối. 5 hệ thống nền tảng: MTUA, AXIS, RACT, CTR, BOILE. Tác giả Nguyễn Chí Thành — Triết Nghiệm Gia.",
    keywords: [
      "The Lifecar",
      "Chiếc xe cuộc đời",
      "Nguyễn Chí Thành",
      "sách phát triển bản thân",
      "triết lý sống",
      "cấu trúc sống",
    ],
    ogImage: "/images/og.jpg", // TODO: ảnh share 1200x630
    locale: "vi_VN",
    twitterHandle: "@thelifecar",
  },

  brand: {
    name: "THE LIFECAR",
    trademark: "™",
    tagline: "CHIẾC XE CUỘC ĐỜI",
  },

  // --- Menu điều hướng ---
  nav: [
    { label: "Trang chủ", href: "#hero" },
    { label: "Nội dung sách", href: "#he-thong" },
    { label: "Tác giả", href: "#tac-gia" },
    { label: "Cảm nhận", href: "#cam-nhan" },
    { label: "FAQ", href: "#faq" },
  ],

  cta: {
    primaryLabel: "MUA SÁCH NGAY",
    primaryHref: "#dat-hang",
    secondaryLabel: "Xem giới thiệu",
    secondaryHref: "#gioi-thieu",
  },

  // --- Hero ---
  hero: {
    eyebrow: "MỘT CẤU TRÚC SỐNG ĐỂ TIẾN XA MÀ KHÔNG LẠC LỐI",
    titleLines: ["THE", "LIFECAR"],
    subtitle:
      "Kim chỉ nam giúp bạn làm chủ hành trình của mình, đi đúng hướng và bứt phá đến mục tiêu.",
    coverImage: "/images/biasach.jpeg", // ảnh bìa sách thật
    coverAlt: "Bìa sách The Lifecar — Chiếc Xe Cuộc Đời",
    highlights: [
      { title: "5 hệ thống", desc: "Nền tảng cốt lõi" },
      { title: "Bài tập thực hành", desc: "Ứng dụng ngay" },
      { title: "Lộ trình rõ ràng", desc: "Dễ hiểu, dễ áp dụng" },
    ],
  },

  // --- Value bar (định vị cuốn sách) ---
  valueBarLead:
    "Một cấu trúc sống hoàn chỉnh — không phải những lời khuyên rời rạc.",
  valueBar: [
    {
      title: "Dành cho",
      desc: "Bất kỳ ai muốn thiết kế cuộc đời mình",
      image: "/images/number-01-self-awareness.jpg",
    },
    {
      title: "Mục tiêu",
      desc: "Sống có định hướng, hiệu quả và hạnh phúc",
      image: "/images/number-02-direction.jpg",
    },
    {
      title: "Kết quả",
      desc: "Tiến xa hơn mỗi ngày mà không lạc lối",
      image: "/images/number-03-results.jpg",
    },
    {
      title: "Hành trình",
      desc: "Từ nhận thức đến hành động đến kết quả bền vững",
      image: "/images/number-04-journey.jpg",
    },
  ],

  // --- 5 hệ thống nền tảng (theo bìa sách) ---
  systemsTitle: "5 hệ thống nền tảng",
  systemsLead:
    "Năm trục vận hành của một đời sống có chủ đích — kết hợp lại thành chiếc xe đưa bạn đi xa mà không lạc lối.",
  systems: [
    {
      code: "MTUA",
      name: "Kim chỉ nam",
      desc: "Xác định mục tiêu và lý do đủ lớn",
    },
    {
      code: "AXIS",
      name: "Trục cân bằng",
      desc: "Cân bằng các khía cạnh cuộc sống",
    },
    {
      code: "RACT",
      name: "Tư duy hành động",
      desc: "Phân vai — rõ trách nhiệm — tạo kết quả",
    },
    {
      code: "CTR",
      name: "Bối cảnh",
      desc: "Hiểu bối cảnh để ra quyết định đúng",
    },
    {
      code: "BOILE",
      name: "Văn hoá & Niềm tin",
      desc: "Xây dựng niềm tin và giá trị bền vững",
    },
  ],

  // --- Quote ---
  quote: {
    text: "Cuộc đời là một hành trình. Không quan trọng bạn bắt đầu ở đâu, mà là bạn có bản đồ và kim chỉ nam hay không.",
    author: "",
  },

  // --- Tác giả ---
  author: {
    sectionLabel: "VỀ TÁC GIẢ",
    name: "NGUYỄN CHÍ THÀNH",
    role: "TRIẾT NGHIỆM GIA",
    photo: "/images/tacgia.jpg",
    photoAlt: "Tác giả Nguyễn Chí Thành",
    bio: "Người dành nhiều năm nghiên cứu và hệ thống hóa triết lý sống thực tiễn, giúp hàng nghìn người thiết kế cuộc đời theo cách chủ động, rõ ràng và hiệu quả.",
    stats: [
      { value: "10+", label: "Năm nghiên cứu và thực hành" },
      { value: "1000+", label: "Người đã ứng dụng thành công" },
      { value: "5", label: "Hệ thống nền tảng độc quyền" },
    ],
    publisher: "Nhà xuất bản Kinh tế TP. Hồ Chí Minh (UEH)",
  },

  // --- Cảm nhận độc giả ---
  reviewsTitle: "CẢM NHẬN ĐỘC GIẢ",
  reviews: [
    {
      stars: 5,
      text: "Một cuốn sách thực tiễn, dễ hiểu và có thể áp dụng ngay vào cuộc sống. Đã giúp tôi tìm lại định hướng và động lực mỗi ngày.",
      name: "Minh Anh",
      title: "Nhân viên văn phòng",
      avatar: "",
    },
    {
      stars: 5,
      text: "Hệ thống Lifecar giúp tôi nhìn rõ bức tranh cuộc đời và biết cách hành động đúng trọng tâm.",
      name: "Quang Huy",
      title: "Chủ doanh nghiệp",
      avatar: "",
    },
    {
      stars: 5,
      text: "Không hề là lý thuyết, sách có rất nhiều bài tập thực hành giúp thay đổi tư duy và thói quen.",
      name: "Thu Trang",
      title: "Giáo viên",
      avatar: "",
    },
    {
      stars: 5,
      text: "Đọc xong tôi mới hiểu vì sao mình chăm chỉ nhưng vẫn không tiến xa. Cuốn sách chỉ ra đúng chỗ tôi đang thiếu.",
      name: "Đức Trọng",
      title: "Kỹ sư phần mềm",
      avatar: "",
    },
    {
      stars: 5,
      text: "Mỗi chương là một công cụ dùng được ngay. Tôi đã áp dụng MTUA để đặt lại mục tiêu năm nay và thấy rõ sự khác biệt.",
      name: "Lan Phương",
      title: "Trưởng nhóm marketing",
      avatar: "",
    },
    {
      stars: 5,
      text: "Ngôn ngữ gần gũi, ví dụ đời thường. Vợ chồng tôi cùng đọc và dùng nó để thống nhất kế hoạch gia đình.",
      name: "Hoàng Nam",
      title: "Chủ cửa hàng",
      avatar: "",
    },
    {
      stars: 5,
      text: "Tôi từng đọc nhiều sách phát triển bản thân nhưng bỏ dở. Cuốn này có lộ trình nên tôi đi được đến cuối.",
      name: "Thanh Hà",
      title: "Sinh viên năm cuối",
      avatar: "",
    },
    {
      stars: 5,
      text: "Phần CTR về bối cảnh thay đổi cách tôi ra quyết định trong công việc. Bớt cảm tính, rõ ràng hơn hẳn.",
      name: "Vũ Cường",
      title: "Quản lý dự án",
      avatar: "",
    },
    {
      stars: 5,
      text: "Không hô hào, không hứa hẹn viển vông. Chỉ là một cấu trúc rõ ràng để tự mình đi. Đúng thứ tôi cần.",
      name: "Mỹ Linh",
      title: "Bác sĩ",
      avatar: "",
    },
  ],

  // --- FAQ ---
  faqTitle: "CÂU HỎI THƯỜNG GẶP",
  faq: [
    {
      q: "Sách phù hợp với ai?",
      a: "Bất kỳ ai muốn sống có định hướng rõ ràng và chủ động thiết kế cuộc đời mình — không giới hạn độ tuổi hay ngành nghề.",
    },
    {
      q: "Sách có bài tập thực hành không?",
      a: "Có. Mỗi hệ thống đều kèm bài tập và ví dụ để bạn áp dụng ngay.",
    },
    {
      q: "Giao hàng trong bao lâu?",
      a: "2–5 ngày làm việc tùy khu vực. Giao toàn quốc.",
    },
    {
      q: "Có được đổi trả không?",
      a: "Đổi trả trong 7 ngày nếu sách lỗi in ấn hoặc hư hỏng do vận chuyển.",
    },
  ],

  // --- CTA cuối / đặt hàng ---
  finalCta: {
    heading: "SỞ HỮU NGAY THE LIFECAR",
    sub: "CHIẾC XE CUỘC ĐỜI",
    price: "198.000đ",
    priceLabel: "Giá bìa:",
    perks: [
      "Giao hàng toàn quốc",
      "Đổi trả trong 7 ngày",
      "Thanh toán an toàn",
    ],
  },

  // --- Form đặt hàng (giả — nối API sau) ---
  orderForm: {
    heading: "ĐẶT SÁCH",
    note: "Điền thông tin, chúng tôi sẽ gọi xác nhận trong 24h.",
    fields: {
      name: "Họ và tên",
      phone: "Số điện thoại",
      address: "Địa chỉ nhận sách",
      quantity: "Số lượng",
    },
    submitLabel: "GỬI ĐƠN HÀNG",
    action: "", // TODO: URL API nhận đơn / Google Form / CRM
  },

  // --- Footer ---
  footer: {
    linksTitle: "LIÊN KẾT",
    links: [
      { label: "Trang chủ", href: "#hero" },
      { label: "Nội dung sách", href: "#he-thong" },
      { label: "Tác giả", href: "#tac-gia" },
      { label: "Cảm nhận", href: "#cam-nhan" },
      { label: "FAQ", href: "#faq" },
    ],
    policyTitle: "CHÍNH SÁCH",
    policies: [
      { label: "Chính sách đổi trả", href: "#" },
      { label: "Chính sách bảo mật", href: "#" },
      { label: "Hướng dẫn mua hàng", href: "#" },
      { label: "Điều khoản sử dụng", href: "#" },
    ],
    socialTitle: "KẾT NỐI",
    socials: [
      { label: "Facebook", href: "#" },
      { label: "YouTube", href: "#" },
      { label: "TikTok", href: "#" },
      { label: "Instagram", href: "#" },
    ],
    copyright: "© 2024 The Lifecar. All rights reserved.",
  },
};

export type Site = typeof site;
