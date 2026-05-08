import Link from 'next/link';

interface Crumb {
  label: string;
  href?: string;
}

interface NavBarProps {
  crumbs?: Crumb[];
}

export function NavBar({ crumbs = [] }: NavBarProps) {
  return (
    <header className="bg-white border-b border-gray-100 px-8 py-4 flex items-center gap-2 text-sm">
      <Link href="/" className="font-semibold text-blue-600 hover:text-blue-700">
        CuVR Physio
      </Link>
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-2">
          <span className="text-gray-300">/</span>
          {crumb.href ? (
            <Link href={crumb.href} className="text-gray-500 hover:text-gray-700">
              {crumb.label}
            </Link>
          ) : (
            <span className="text-gray-800 font-medium">{crumb.label}</span>
          )}
        </span>
      ))}
    </header>
  );
}
