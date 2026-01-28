export interface Speaker {
  id: string;
  name: string;
  title: string;
  company: string;
  bio: string;
  image: string;
  topic: string;
}

export interface TimelineItem {
  id: string;
  time: string;
  title: string;
  description: string;
  type: 'talk' | 'break' | 'networking' | 'performance';
  speakerId?: string;
}

export interface EventBackground {
  type: 'image' | 'video' | 'gradient';
  value: string;
  overlay: string;
}

export interface Event {
  id: string;
  name: string;
  tagline: string;
  description: string;
  date: string;
  time: string;
  venue: string;
  location: string;
  background: EventBackground;
  highlights: { icon: string; text: string }[];
  speakers: Speaker[];
  timeline: TimelineItem[];
  ticketTypes: TicketType[];
  seatMap: SeatRow[];
}

export interface TicketType {
  id: string;
  name: string;
  price: number;
  description: string;
}

export interface Seat {
  id: string;
  row: string;
  number: number;
  status: 'available' | 'selected' | 'sold';
  ticketTypeId: string;
  price: number;
}

export interface SeatRow {
  row: string;
  seats: Seat[];
}

export interface Order {
  id: string;
  orderCode: string;
  eventId: string;
  eventName: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  seats: { row: string; number: number; price: number }[];
  totalPrice: number;
  paymentMethod: string;
  paymentStatus: 'pending' | 'completed' | 'failed';
  createdAt: string;
}

const generateSeatMap = (): SeatRow[] => {
  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const seatsPerRow = 12;
  const soldSeats = ['A3', 'A4', 'B5', 'B6', 'C7', 'D2', 'E8', 'F1', 'G10', 'H5', 'H6'];
  
  return rows.map((row) => ({
    row,
    seats: Array.from({ length: seatsPerRow }, (_, i) => {
      const seatId = `${row}${i + 1}`;
      const isSold = soldSeats.includes(seatId);
      const isVIP = ['A', 'B'].includes(row);
      return {
        id: seatId,
        row,
        number: i + 1,
        status: isSold ? 'sold' : 'available',
        ticketTypeId: isVIP ? 'vip' : 'standard',
        price: isVIP ? 150 : 80,
      } as Seat;
    }),
  }));
};

// Speakers for TEDxFPTUniversityHCMC
const tedxSpeakers: Speaker[] = [
  {
    id: 's1',
    name: 'Dr. Nguyen Thi Mai',
    title: 'AI Research Director tại VinAI Research với hơn 15 năm kinh nghiệm trong lĩnh vực Machine Learning và Computer Vision. Cô đã dẫn dắt nhiều dự án nghiên cứu đột phá và công bố hơn 50 bài báo khoa học tại các hội nghị quốc tế hàng đầu.',
    company: 'VinAI Research',
    bio: 'Leading AI researcher with 15+ years of experience in machine learning and computer vision.',
    image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop',
    topic: 'The Future of AI in Southeast Asia',
  },
  {
    id: 's2',
    name: 'Tran Minh Duc',
    title: 'Founder & CEO của EcoVietnam - startup tiên phong trong lĩnh vực nông nghiệp bền vững tại Đồng bằng sông Cửu Long. Anh đã giúp hơn 10,000 nông dân chuyển đổi sang phương pháp canh tác thân thiện với môi trường.',
    company: 'EcoVietnam',
    bio: 'Social entrepreneur revolutionizing sustainable agriculture in the Mekong Delta.',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
    topic: 'Reimagining Agriculture for Climate Resilience',
  },
  {
    id: 's3',
    name: 'Le Hoang Anh',
    title: 'Tác giả đoạt giải thưởng văn học với 5 cuốn sách bestseller về bản sắc Việt Nam và trải nghiệm kiều bào. Tác phẩm của cô đã được dịch ra 12 ngôn ngữ và được đưa vào chương trình giảng dạy tại nhiều trường đại học.',
    company: 'Independent',
    bio: 'Bestselling author exploring Vietnamese identity and diaspora experiences.',
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop',
    topic: 'Stories That Connect Us',
  },
  {
    id: 's4',
    name: 'Prof. Pham Van Tuan',
    title: 'Giáo sư Vật lý Lượng tử tại Đại học Quốc gia Việt Nam, chuyên gia hàng đầu về điện toán lượng tử. Ông đang dẫn dắt dự án xây dựng máy tính lượng tử đầu tiên của Việt Nam với sự hợp tác của IBM và Google.',
    company: 'Vietnam National University',
    bio: 'Pioneering researcher in quantum computing and its applications.',
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop',
    topic: 'Quantum Leap: Computing Beyond Limits',
  },
];

// Timeline for TEDxFPTUniversityHCMC
const tedxTimeline: TimelineItem[] = [
  { id: 't1', time: '08:30', title: 'Registration & Welcome Coffee', description: 'Check-in and networking', type: 'networking' },
  { id: 't2', time: '09:00', title: 'Opening Ceremony', description: 'Welcome address and introduction', type: 'talk' },
  { id: 't3', time: '09:30', title: 'The Future of AI in Southeast Asia', description: 'Keynote by Dr. Nguyen Thi Mai', type: 'talk', speakerId: 's1' },
  { id: 't4', time: '10:00', title: 'Reimagining Agriculture', description: 'Talk by Tran Minh Duc', type: 'talk', speakerId: 's2' },
  { id: 't5', time: '10:30', title: 'Coffee Break', description: 'Refreshments and networking', type: 'break' },
  { id: 't6', time: '11:00', title: 'Stories That Connect Us', description: 'Talk by Le Hoang Anh', type: 'talk', speakerId: 's3' },
  { id: 't7', time: '11:30', title: 'Quantum Leap', description: 'Talk by Prof. Pham Van Tuan', type: 'talk', speakerId: 's4' },
  { id: 't8', time: '12:00', title: 'Lunch Break', description: 'Networking lunch with speakers', type: 'break' },
  { id: 't9', time: '14:00', title: 'Musical Performance', description: 'Live performance by local artists', type: 'performance' },
  { id: 't10', time: '14:30', title: 'Panel Discussion', description: 'Innovation in Vietnam', type: 'talk' },
  { id: 't11', time: '15:30', title: 'Networking Session', description: 'Connect with speakers and attendees', type: 'networking' },
  { id: 't12', time: '17:00', title: 'Closing Ceremony', description: 'Wrap-up and photo session', type: 'talk' },
];

export const events: Event[] = [
  {
    id: '1',
    name: 'TEDxFPTUniversityHCMC 2026: Finding Flow',
    tagline: 'Finding Flow',
    description: 'TEDxFPTUniversityHCMC 2026: Finding Flow brings together visionaries, innovators, and change-makers to share groundbreaking ideas about achieving flow states in work, creativity, and life. Join us for an unforgettable day of powerful talks, creative performances, and meaningful connections that will transform the way you see the world.',
    date: '2026-03-15',
    time: '08:30 AM - 06:00 PM',
    venue: 'FPT University HCMC Campus',
    location: 'Ho Chi Minh City, Vietnam',
    background: {
      type: 'image',
      value: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=1920&h=1080&fit=crop',
      overlay: 'linear-gradient(135deg, rgba(230,43,30,0.9) 0%, rgba(26,26,26,0.95) 100%)',
    },
    highlights: [
      { icon: 'mic', text: '12 Inspiring Speakers' },
      { icon: 'lightbulb', text: 'Ideas Worth Spreading' },
      { icon: 'users', text: '500+ Attendees' },
      { icon: 'coffee', text: 'Networking Sessions' },
    ],
    speakers: tedxSpeakers,
    timeline: tedxTimeline,
    ticketTypes: [
      { id: 'vip', name: 'VIP Experience', price: 2500000, description: 'Premium seating, Speaker meet & greet, Exclusive dinner' },
      { id: 'standard', name: 'Standard Pass', price: 1500000, description: 'General admission, All talks access, Lunch included' },
    ],
    seatMap: generateSeatMap(),
  },
  {
    id: '2',
    name: 'TEDxYouth@Saigon',
    tagline: 'Young Voices, Bold Ideas',
    description: 'Empowering the next generation of thinkers and leaders. TEDxYouth@Saigon celebrates young voices with fresh perspectives on technology, creativity, and social change.',
    date: '2026-04-20',
    time: '09:00 AM - 04:00 PM',
    venue: 'RMIT University Vietnam',
    location: 'Ho Chi Minh City, Vietnam',
    background: {
      type: 'gradient',
      value: 'linear-gradient(135deg, #e62b1e 0%, #1a1a1a 100%)',
      overlay: '',
    },
    highlights: [
      { icon: 'sparkles', text: 'Young Innovators' },
      { icon: 'presentation', text: '8 Youth Speakers' },
      { icon: 'music', text: 'Live Performances' },
      { icon: 'heart', text: 'Community Impact' },
    ],
    speakers: [],
    timeline: [],
    ticketTypes: [
      { id: 'vip', name: 'Supporter Pass', price: 1800000, description: 'Priority seating, Event merchandise, Photo opportunity' },
      { id: 'standard', name: 'Student Pass', price: 800000, description: 'General admission, All sessions access' },
    ],
    seatMap: generateSeatMap(),
  },
];

export const orders: Order[] = [
  {
    id: '1',
    orderCode: 'ORD-2026-001',
    eventId: '1',
    eventName: 'TechConnect Summit 2026',
    customerName: 'Nguyen Van A',
    customerEmail: 'nguyenvana@email.com',
    customerPhone: '0901234567',
    seats: [{ row: 'A', number: 1, price: 150 }, { row: 'A', number: 2, price: 150 }],
    totalPrice: 300,
    paymentMethod: 'VNPay',
    paymentStatus: 'completed',
    createdAt: '2026-01-15T10:30:00Z',
  },
  {
    id: '2',
    orderCode: 'ORD-2026-002',
    eventId: '1',
    eventName: 'TechConnect Summit 2026',
    customerName: 'Tran Thi B',
    customerEmail: 'tranthib@email.com',
    customerPhone: '0912345678',
    seats: [{ row: 'C', number: 5, price: 80 }],
    totalPrice: 80,
    paymentMethod: 'Momo',
    paymentStatus: 'completed',
    createdAt: '2026-01-16T14:20:00Z',
  },
];

export const getEventById = (id: string): Event | undefined => events.find(e => e.id === id);
export const getOrderById = (id: string): Order | undefined => orders.find(o => o.id === id);

