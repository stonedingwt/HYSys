import { useState } from 'react';
import { Star, Trash2, Plus, Image as ImageIcon } from 'lucide-react';

interface Props {
  images: string[];
  primaryIndex: number;
  onChange: (images: string[], primaryIndex: number) => void;
  readonly?: boolean;
}

export default function StyleImageGallery({ images, primaryIndex, onChange, readonly }: Props) {
  const [addUrl, setAddUrl] = useState('');

  const setPrimary = (idx: number) => {
    if (readonly) return;
    onChange(images, idx);
  };

  const removeImage = (idx: number) => {
    if (readonly) return;
    const newImages = images.filter((_, i) => i !== idx);
    let newPrimary = primaryIndex;
    if (idx === primaryIndex) newPrimary = 0;
    else if (idx < primaryIndex) newPrimary = primaryIndex - 1;
    onChange(newImages, Math.min(newPrimary, Math.max(0, newImages.length - 1)));
  };

  const addImage = () => {
    if (!addUrl.trim()) return;
    onChange([...images, addUrl.trim()], primaryIndex);
    setAddUrl('');
  };

  if (!images.length && readonly) {
    return (
      <div className="flex items-center justify-center p-8 border-2 border-dashed rounded-lg text-gray-400 dark:border-gray-700">
        <ImageIcon className="w-5 h-5 mr-2" />
        <span className="text-sm">暂无款式图</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {images.map((url, idx) => (
          <div
            key={idx}
            className={`relative group rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
              idx === primaryIndex
                ? 'border-amber-400 ring-2 ring-amber-200 dark:ring-amber-800'
                : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
            }`}
            onClick={() => setPrimary(idx)}
          >
            <img
              src={url}
              alt={`款式图${idx + 1}`}
              className="w-full h-32 object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23f3f4f6" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%239ca3af" font-size="12">图片加载失败</text></svg>';
              }}
            />
            {idx === primaryIndex && (
              <div className="absolute top-1 left-1 bg-amber-400 text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 font-medium">
                <Star className="w-3 h-3" fill="currentColor" />
                首图
              </div>
            )}
            {idx === primaryIndex && (
              <div className="absolute bottom-0 left-0 right-0 bg-amber-400/90 text-white text-[10px] text-center py-0.5">
                首图
              </div>
            )}
            {!readonly && (
              <button
                onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>
      {!readonly && (
        <div className="flex items-center gap-2">
          <input
            value={addUrl}
            onChange={(e) => setAddUrl(e.target.value)}
            placeholder="输入图片URL添加"
            className="flex-1 text-sm px-3 py-1.5 border rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
            onKeyDown={(e) => e.key === 'Enter' && addImage()}
          />
          <button
            onClick={addImage}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400"
          >
            <Plus className="w-3.5 h-3.5" />
            添加
          </button>
        </div>
      )}
      {images.length > 0 && !readonly && (
        <p className="text-[11px] text-gray-400">点击图片设为首图</p>
      )}
    </div>
  );
}
