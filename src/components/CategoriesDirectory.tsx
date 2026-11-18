import { ArrowRight } from 'lucide-react';
import { CategoryItem } from '../types.ts';

interface CategoriesDirectoryProps {
  categories: CategoryItem[];
  onSelectCategory: (slug: string) => void;
}

export function CategoriesDirectory({ categories, onSelectCategory }: CategoriesDirectoryProps) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Job Categories
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Every collected opportunity is automatically categorised across 15 core employment sectors
          using title and skill classification rules.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => (
          <button
            key={cat.slug}
            type="button"
            onClick={() => onSelectCategory(cat.slug)}
            className="group flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-left transition-all duration-150 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm cursor-pointer"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-50 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                  {cat.name}
                </h2>
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 tabular-nums whitespace-nowrap shrink-0">
                  {cat.jobCount} {cat.jobCount === 1 ? 'role' : 'roles'}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{cat.description}</p>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="truncate pr-3">
                {cat.keywords.slice(0, 4).join(' · ')}
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
