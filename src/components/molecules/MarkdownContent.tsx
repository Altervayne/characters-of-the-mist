import ReactMarkdown from 'react-markdown';

export default function MarkdownContent({ content }: { content: string }) {
   return (
      <ReactMarkdown
         components={{
            h4: ({...props}) => <h4 className="text-lg font-semibold text-foreground mt-6 first:mt-0 mb-2" {...props} />,
            p: ({...props}) => <p className="text-sm text-muted-foreground mb-4 leading-relaxed" {...props} />,
            a: ({...props}) => <a className="text-primary font-medium hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
            strong: ({...props}) => <strong className="font-bold text-foreground" {...props} />,
            ul: ({...props}) => <ul className="list-disc pl-6 my-4 space-y-2" {...props} />,
            li: ({...props}) => <li className="text-sm text-muted-foreground" {...props} />,
         }}
      >
         {content}
      </ReactMarkdown>
   )
};