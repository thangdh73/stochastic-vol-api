import { NavLink } from 'react-router-dom'

export type MainSubNavItem = {
  to: string
  label: string
  end?: boolean
}

type Props = {
  title: string
  description?: string
  items: MainSubNavItem[]
}

export function MainSubNav({ title, description, items }: Props) {
  return (
    <div className="main-subnav">
      <div className="main-subnav-head">
        <h2 className="main-subnav-title">{title}</h2>
        {description && <p className="convention-inline muted main-subnav-desc">{description}</p>}
      </div>
      <nav className="main-subnav-tabs" aria-label={`${title} sub-pages`}>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => (isActive ? 'sub-tab active' : 'sub-tab')}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
