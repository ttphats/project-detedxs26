# Constants

Thư mục chứa các hằng số dùng chung trong ứng dụng.

## Menu Labels (`menu.ts`)

Quản lý tập trung các label hiển thị trong sidebar admin.

### Sử dụng:

```typescript
import { MENU_LABELS } from '@/constants/menu'

// Trong component
<span>{MENU_LABELS.DASHBOARD}</span>
<span>{MENU_LABELS.ORDERS}</span>
```

### Lợi ích:

1. **Nhất quán**: Tất cả menu labels được định nghĩa ở một chỗ
2. **Dễ bảo trì**: Thay đổi label chỉ cần sửa ở một file
3. **Type-safe**: TypeScript kiểm tra lỗi chính tả
4. **Đa ngôn ngữ**: Dễ dàng thêm i18n sau này

### Quy tắc:

- Tất cả labels đều bằng **Tiếng Việt** để nhất quán
- Sử dụng UPPER_SNAKE_CASE cho tên constant
- Label hiển thị dùng Title Case (chữ hoa đầu từ)
