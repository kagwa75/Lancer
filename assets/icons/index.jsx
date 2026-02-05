 
const icons = {
    
}
const Icon = ({name, ...props}) => {
  const IconComponent = icons[name];
  return (
   <IconComponent 
   height={props.size || 24}
   width={props.size || 24}
   strokeWidth={props.strokeWidth || 1.9}
   color={props.colors}
   {...props}
   />
  )
}

export default Icon