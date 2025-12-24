
import React, { useEffect, useRef, memo } from 'react';

interface MathTextProps {
  content: string;
  className?: string;
}

const MathText: React.FC<MathTextProps> = ({ content, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    const renderMath = () => {
      const MJ = (window as any).MathJax;
      
      if (containerRef.current) {
        // Cập nhật nội dung HTML thủ công để tránh React can thiệp sau khi đã render
        containerRef.current.innerHTML = content;
      }

      if (MJ && MJ.typesetPromise && MJ.startup && containerRef.current) {
        // Đưa vào hàng đợi của MathJax để xử lý tuần tự
        MJ.startup.promise = MJ.startup.promise
          .then(() => {
            if (isMounted && containerRef.current) {
              // Xóa cache cũ cho riêng node này và render mới
              if (MJ.typesetClear) MJ.typesetClear([containerRef.current]);
              return MJ.typesetPromise([containerRef.current]);
            }
          })
          .catch((err: any) => console.error('MathJax Error:', err));
      } else if (isMounted) {
        // Thử lại nếu thư viện chưa sẵn sàng
        setTimeout(renderMath, 150);
      }
    };

    renderMath();

    return () => {
      isMounted = false;
    };
  }, [content]);

  // Không dùng dangerouslySetInnerHTML ở đây để React không bao giờ tự ý thay đổi nội dung bên trong div này
  return (
    <div 
      ref={containerRef} 
      className={`${className} mathjax-container`}
      style={{ minHeight: '1.2em' }}
    />
  );
};

// Quan trọng: memo giúp component không bị render lại nếu content giữ nguyên (khi timer chạy)
export default memo(MathText);
