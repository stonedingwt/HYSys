import { useLocalize } from '~/hooks';

const SegmentSelector = ({ lingsi, onChange }) => {
    const localize = useLocalize();

    return (
        <div className="w-full">
            <div className="p-1 rounded-full border border-gray-200 dark:border-gray-600 flex bg-white dark:bg-gray-800">
                <button
                    className={`flex-1 py-1.5 px-8 rounded-full text-sm break-keep transition-all ${!lingsi
                        ? 'bg-blue-50 dark:bg-blue-900/40 shadow-sm text-blue-700 dark:text-blue-300'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                        }`}
                    onClick={() => onChange(false)}
                >
                    {localize('com_segment_daily_mode')}
                </button>
                <button
                    className={`flex-1 py-1.5 px-8 rounded-full text-sm break-keep transition-all ${lingsi
                        ? 'bg-blue-50 dark:bg-blue-900/40 shadow-sm text-blue-700 dark:text-blue-300'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                        }`}
                    onClick={() => onChange(true)}
                >
                    <div className='flex items-center justify-center relative'>
                        <span>{localize('com_segment_linsight')}</span>
                    </div>
                </button>
            </div>
        </div>
    );
};

export default SegmentSelector;