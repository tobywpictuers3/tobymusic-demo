
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, Mail, MessageCircle } from 'lucide-react';

const ContactsList = () => {
  const contacts = [
    {
      name: 'טובי וינברג - המורה',
      phone: '0504124161',
      email: 'toby.musicartist@gmail.com',
      whatsapp: '0733837098',
      role: 'מורה לפסנתר',
      tagline: 'איתך, כל הדרך אל המוסיקה'
    }
  ];

  return (
    <Card className="card-gradient card-shadow">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center gap-2">
          <Phone className="h-6 w-6" />
          פרטי קשר
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {contacts.map((contact, index) => (
            <div key={index} className="p-4 bg-secondary/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{contact.name}</h3>
                  <p className="text-sm text-muted-foreground mb-3">{contact.role}</p>
                </div>
              </div>
              
              <div className="space-y-3">
                {contact.tagline && (
                  <p className="text-sm italic text-muted-foreground mb-2">{contact.tagline}</p>
                )}
                
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  <span className="text-sm">נייד:</span>
                  <a 
                    href={`tel:${contact.phone}`}
                    className="text-primary hover:underline font-medium"
                  >
                    {contact.phone}
                  </a>
                </div>
                
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <span className="text-sm">מייל:</span>
                  <a 
                    href={`mailto:${contact.email}`}
                    className="text-primary hover:underline font-medium"
                  >
                    {contact.email}
                  </a>
                </div>
                
                {contact.whatsapp && (
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-primary" />
                    <span className="text-sm">ווטסאפ טלפוני:</span>
                    <a 
                      href={`tel:${contact.whatsapp}`}
                      className="text-primary hover:underline font-medium"
                    >
                      {contact.whatsapp}
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ContactsList;
