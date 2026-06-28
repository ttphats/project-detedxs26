"use client";

import Link from "next/link";
import { ArrowLeft, ShieldCheck, Database, Eye, Lock, FileText } from "lucide-react";

export default function PrivacyPage() {
  const lastUpdated = "27 tháng 06, 2026";

  const sections = [
    {
      icon: Database,
      title: "1. Thông tin chúng tôi thu thập",
      content: (
        <>
          <p className="mb-3">
            Khi bạn sử dụng website hoặc đăng ký mua vé tham gia sự kiện TEDxFPTUniversityHCMC, chúng tôi có thể thu thập các thông tin cá nhân sau:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-gray-400">
            <li>Thông tin liên hệ: Họ và tên, địa chỉ email, số điện thoại.</li>
            <li>Thông tin định danh học viên/sinh viên (nếu có): Mã số sinh viên (để áp dụng các chương trình ưu đãi dành riêng cho sinh viên).</li>
            <li>Thông tin giao dịch: Chi tiết đơn hàng, lịch sử mua vé và trạng thái thanh toán (chúng tôi không lưu trữ thông tin thẻ tín dụng hoặc thông tin ngân hàng của bạn trực tiếp, toàn bộ giao dịch được xử lý qua cổng thanh toán bảo mật).</li>
          </ul>
        </>
      ),
    },
    {
      icon: Eye,
      title: "2. Cách chúng tôi sử dụng thông tin",
      content: (
        <>
          <p className="mb-3">
            Chúng tôi sử dụng thông tin cá nhân của bạn cho các mục đích chính đáng sau:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-gray-400">
            <li>Xử lý và hoàn tất các đơn đặt vé, gửi vé điện tử (e-ticket) và mã check-in qua email/SMS.</li>
            <li>Gửi thông báo cập nhật về sự kiện, hướng dẫn tham dự hoặc các thay đổi quan trọng liên quan đến TEDxFPTUniversityHCMC.</li>
            <li>Xác minh danh tính sinh viên để áp dụng mức giá ưu đãi phù hợp.</li>
            <li>Hỗ trợ giải quyết các khiếu nại, phản hồi của người tham gia.</li>
            <li>Phân tích dữ liệu ẩn danh để cải thiện trải nghiệm người dùng trên hệ thống website của chúng tôi.</li>
          </ul>
        </>
      ),
    },
    {
      icon: Lock,
      title: "3. Bảo mật thông tin",
      content: (
        <>
          <p className="mb-3">
            TEDxFPTUniversityHCMC cam kết bảo vệ an toàn thông tin cá nhân của bạn bằng các biện pháp kỹ thuật và tổ chức phù hợp:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-gray-400">
            <li>Dữ liệu truyền tải giữa trình duyệt của bạn và máy chủ luôn được mã hóa thông qua chuẩn bảo mật SSL/HTTPS.</li>
            <li>Quyền truy cập vào dữ liệu cá nhân của người dùng bị giới hạn nghiêm ngặt và chỉ cung cấp cho các thành viên Ban Tổ chức được phân quyền và có trách nhiệm xử lý công việc trực tiếp.</li>
            <li>Chúng tôi cam kết không bán, trao đổi hoặc cho bên thứ ba thuê thông tin cá nhân của bạn vì mục đích thương mại.</li>
          </ul>
        </>
      ),
    },
    {
      icon: ShieldCheck,
      title: "4. Quyền hạn của bạn đối với dữ liệu",
      content: (
        <>
          <p className="mb-3">
            Bạn có toàn quyền kiểm soát thông tin cá nhân của mình, bao gồm các quyền sau:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-gray-400">
            <li>Yêu cầu truy cập, xem hoặc chỉnh sửa các thông tin liên hệ bị sai lệch trong hệ thống.</li>
            <li>Yêu cầu xóa bỏ thông tin cá nhân của bạn khỏi cơ sở dữ liệu lưu trữ của chúng tôi sau khi sự kiện kết thúc.</li>
            <li>Từ chối nhận các email thông báo hoặc thông tin tiếp thị từ Ban Tổ chức bằng cách nhấp vào liên kết hủy đăng ký ở cuối mỗi email.</li>
          </ul>
        </>
      ),
    },
    {
      icon: FileText,
      title: "5. Thay đổi về Chính sách bảo mật",
      content: (
        <p className="text-gray-400">
          Ban Tổ chức TEDxFPTUniversityHCMC có quyền cập nhật hoặc thay đổi chính sách bảo mật này bất cứ lúc nào. Mọi thay đổi sẽ có hiệu lực ngay khi được đăng tải trên trang web này kèm theo ngày cập nhật mới nhất ở đầu trang. Chúng tôi khuyến khích bạn thường xuyên kiểm tra trang này để nắm bắt thông tin bảo mật mới nhất.
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
            CHÍNH SÁCH <span className="text-red-600 font-black">BẢO MẬT</span>
          </h1>
          <p className="text-gray-500 text-sm">
            Cập nhật lần cuối: {lastUpdated}
          </p>
        </div>

        {/* Introduction */}
        <div className="prose prose-invert max-w-none text-gray-300 text-base sm:text-lg mb-12 leading-relaxed">
          <p>
            Chào mừng bạn đến với hệ thống bán vé của{" "}
            <span className="font-bold text-white">TEDxFPTUniversityHCMC</span>. Chúng tôi
            coi trọng sự riêng tư và bảo mật thông tin cá nhân của bạn. Chính sách bảo mật này
            giúp bạn hiểu rõ những thông tin nào chúng tôi thu thập, mục đích thu thập và các biện
            pháp chúng tôi thực hiện nhằm bảo vệ thông tin của bạn.
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

        {/* Contact Info Footer inside Page */}
        <div className="mt-16 bg-gradient-to-r from-red-950/20 via-black to-black border border-red-950/50 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <h3 className="text-lg font-bold text-white mb-2">Bạn có câu hỏi hoặc thắc mắc?</h3>
            <p className="text-gray-400 text-sm">
              Hãy liên hệ trực tiếp với Ban Tổ chức qua email để được hỗ trợ nhanh chóng nhất.
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
