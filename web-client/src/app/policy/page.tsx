"use client";

import Link from "next/link";
import { ArrowLeft, Ticket, CalendarDays, Video, HelpCircle, AlertTriangle } from "lucide-react";

export default function PolicyPage() {
  const lastUpdated = "27 tháng 06, 2026";

  const sections = [
    {
      icon: Ticket,
      title: "1. Điều khoản đặt vé & Thanh toán",
      content: (
        <>
          <p className="mb-3">
            Bằng việc mua vé tham gia sự kiện TEDxFPTUniversityHCMC, bạn đồng ý với các điều khoản giao dịch sau:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-gray-400">
            <li>Tất cả các giao dịch mua vé đều phải được hoàn tất thông qua các phương thức thanh toán được chỉ định trên website chính thức.</li>
            <li>Sau khi giao dịch thành công, bạn sẽ nhận được một email xác nhận kèm theo vé điện tử (mã QR code duy nhất) để check-in tại sự kiện. Vui lòng bảo mật mã QR này. Ban Tổ chức không chịu trách nhiệm nếu vé của bạn bị người khác sử dụng do sơ suất bảo mật từ phía bạn.</li>
            <li>Vé giảm giá dành cho sinh viên yêu cầu kiểm tra Mã số sinh viên hợp lệ. Mỗi thẻ sinh viên chỉ được mua tối đa số lượng vé theo quy định của ban tổ chức.</li>
          </ul>
        </>
      ),
    },
    {
      icon: AlertTriangle,
      title: "2. Chính sách hoàn trả & Chuyển nhượng vé",
      content: (
        <>
          <p className="mb-3">
            Để đảm bảo tính minh bạch và công tác tổ chức sự kiện diễn ra thuận lợi nhất, chúng tôi áp dụng chính sách vé như sau:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-gray-400">
            <li><strong className="text-white">Không hoàn trả vé:</strong> Tất cả các vé đã thanh toán thành công đều không được hoàn lại tiền trong mọi trường hợp, trừ khi sự kiện bị hủy bỏ hoàn toàn bởi Ban Tổ chức.</li>
            <li><strong className="text-white">Chuyển nhượng vé:</strong> Bạn được phép chuyển nhượng vé cho người khác trước khi sự kiện diễn ra ít nhất 48 giờ. Việc chuyển nhượng phải được thực hiện đúng quy trình và thông báo cho Ban Tổ chức qua email hỗ trợ để thay đổi thông tin người tham dự trên hệ thống check-in.</li>
          </ul>
        </>
      ),
    },
    {
      icon: CalendarDays,
      title: "3. Quy định ra vào và Tham dự sự kiện",
      content: (
        <>
          <p className="mb-3">
            Người tham dự cần tuân thủ các quy định về an ninh và văn hóa ứng xử tại hội trường sự kiện:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-gray-400">
            <li>Xuất trình vé điện tử (mã QR) hợp lệ cùng giấy tờ tùy thân (CCCD/Thẻ sinh viên) tại quầy check-in để đổi thẻ đeo tham dự (badge).</li>
            <li>Ban Tổ chức có quyền từ chối quyền vào cửa đối với bất kỳ cá nhân nào không xuất trình được vé hợp lệ hoặc có thái độ, hành vi không chuẩn mực làm ảnh hưởng đến trật tự sự kiện.</li>
            <li>Vui lòng đến đúng giờ quy định (giờ mở cửa hội trường). Sau khi chương trình chính thức bắt đầu và đèn hội trường tắt, Ban Tổ chức sẽ hạn chế ra vào để tránh gây gián đoạn cho các diễn giả và khán giả khác.</li>
            <li>Tuân thủ các quy định về an toàn phòng cháy chữa cháy, phòng chống dịch bệnh hoặc chỉ dẫn của đội ngũ điều phối viên sự kiện.</li>
          </ul>
        </>
      ),
    },
    {
      icon: Video,
      title: "4. Quy định ghi hình, Chụp ảnh & Truyền thông",
      content: (
        <>
          <p className="mb-3">
            TEDx là sự kiện được ghi hình toàn bộ phục vụ mục đích lưu trữ và đăng tải trên kênh TEDx toàn cầu:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-gray-400">
            <li>Bằng việc tham gia sự kiện, bạn đồng ý cho phép Ban Tổ chức sử dụng hình ảnh, giọng nói hoặc các đoạn phim ngắn có sự xuất hiện của bạn cho mục đích truyền thông phi lợi nhuận của TEDx.</li>
            <li>Khán giả không được phép sử dụng các thiết bị chụp ảnh, ghi hình chuyên nghiệp (như máy ảnh DSLR, chân máy, máy quay phim) bên trong hội trường mà không có sự đồng ý hoặc thẻ tác nghiệp từ Ban Tổ chức.</li>
            <li>Vui lòng chuyển điện thoại và các thiết bị điện tử sang chế độ im lặng hoặc tắt nguồn khi chương trình đang diễn ra. Tuyệt đối không bật đèn flash khi chụp ảnh bằng điện thoại.</li>
          </ul>
        </>
      ),
    },
    {
      icon: HelpCircle,
      title: "5. Các trường hợp bất khả kháng",
      content: (
        <p className="text-gray-400">
          Trong trường hợp sự kiện buộc phải hoãn hoặc thay đổi thời gian, địa điểm tổ chức do thiên tai, dịch bệnh, hoặc các yêu cầu bất ngờ từ cơ quan chức năng có thẩm quyền, Ban Tổ chức sẽ thông báo sớm nhất đến bạn qua email đăng ký. Vé của bạn sẽ tự động được gia hạn và có giá trị sử dụng cho thời gian hoặc địa điểm mới. Ban Tổ chức không chịu trách nhiệm cho các chi phí phát sinh cá nhân khác của bạn như đi lại, khách sạn.
        </p>
      ),
    },
  ];

  return (
    <div className="bg-black text-white min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-red-500 transition-colors mb-8 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Quay về trang chủ</span>
        </Link>

        {/* Title & Metadata */}
        <div className="border-b border-white/10 pb-8 mb-12">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">
            ĐIỀU KHOẢN & <span className="text-red-600 font-black">ĐIỀU LỆ</span>
          </h1>
          <p className="text-gray-500 text-sm">
            Cập nhật lần cuối: {lastUpdated}
          </p>
        </div>

        {/* Introduction */}
        <div className="prose prose-invert max-w-none text-gray-300 text-base sm:text-lg mb-12 leading-relaxed">
          <p>
            Chào mừng bạn đến với sự kiện{" "}
            <span className="font-bold text-white">TEDxFPTUniversityHCMC</span>. Để đảm bảo sự kiện
            diễn ra thành công tốt đẹp, đem lại trải nghiệm trọn vẹn và an toàn cho tất cả mọi người,
            vui lòng đọc kỹ các quy định, điều khoản dưới đây. Việc hoàn tất mua vé đồng nghĩa với việc bạn
            cam kết tuân thủ đầy đủ các nội dung này.
          </p>
        </div>

        {/* Sections Grid/List */}
        <div className="space-y-12">
          {sections.map((section, idx) => {
            const Icon = section.icon;
            return (
              <section
                key={idx}
                className="bg-[#121212] border border-white/5 rounded-2xl p-6 sm:p-8 hover:border-red-600/35 transition-all duration-300 hover:shadow-[0_0_20px_rgba(230,43,30,0.05)]"
              >
                <div className="flex items-center gap-4 mb-5">
                  <div className="bg-red-600/10 p-3 rounded-xl border border-red-600/20 text-red-600">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold tracking-wide text-white">
                    {section.title}
                  </h2>
                </div>
                <div className="text-gray-300 leading-relaxed text-sm sm:text-base">
                  {section.content}
                </div>
              </section>
            );
          })}
        </div>

        {/* Support Callout */}
        <div className="mt-16 bg-gradient-to-r from-red-950/20 via-black to-black border border-red-950/50 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <h3 className="text-lg font-bold text-white mb-2">Cần trợ giúp giải đáp điều lệ?</h3>
            <p className="text-gray-400 text-sm">
              Ban Tổ chức luôn sẵn sàng lắng nghe và hỗ trợ các yêu cầu của bạn.
            </p>
          </div>
          <a
            href="mailto:tedxfptuniversityhcmc@gmail.com"
            className="inline-flex items-center justify-center bg-red-600 hover:bg-red-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm shrink-0"
          >
            tedxfptuniversityhcmc@gmail.com
          </a>
        </div>
      </div>
    </div>
  );
}
