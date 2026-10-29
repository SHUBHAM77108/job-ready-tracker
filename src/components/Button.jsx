export default function Button({children,onClick,type="button",variant="primary",disabled=false,className="",...rest}) {
  return <button type={type} onClick={onClick} disabled={disabled} className={`button ${variant} ${className}`} {...rest}>{children}</button>;
}
