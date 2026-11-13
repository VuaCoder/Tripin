# Git Commit & Push Policy

- **Chỉ commit khi người dùng yêu cầu trực tiếp trong lượt tin nhắn hiện tại**: Tuyệt đối KHÔNG tự động chạy `git commit` hoặc `git push` sau khi sửa code hay chạy test xong nếu tin nhắn hiện tại của người dùng không yêu cầu commit.
- **Không lặp lại lệnh commit từ các lượt trước**: Nếu ở lượt tin nhắn trước người dùng có bảo "commit", yêu cầu đó chỉ có hiệu lực đúng 1 lần ở lượt đó. Các lượt trao đổi hoặc sửa lỗi tiếp theo tuyệt đối KHÔNG tự động commit/push để tránh tạo quá nhiều commit dư thừa hoặc ghi đè lịch sử git.

