import {Component, OnInit, ViewChild} from '@angular/core';
import {Imovel} from '../imoveis/models/imovel.model';
import {ImoveisService} from '../imoveis/imoveis.service';
import {ActivatedRoute, NavigationEnd, Router} from '@angular/router';
import {NgbModal, NgbModalRef} from '@ng-bootstrap/ng-bootstrap';
import {ImovelService} from './imovel.service';
import {HttpClient} from '@angular/common/http';
import {ToastrService} from 'ngx-toastr';
import {AllImoveis} from "../all-imoveis.service";

@Component({
  selector: 'app-imovel',
  templateUrl: './imovel.component.html',
  styleUrls: ['./imovel.component.css']
})
export class ImovelComponent implements OnInit {

  imovel: Imovel;
  mySlideOptions = {items: 1, dots: true, nav: false};
  myCarouselOptions = {items: 3, dots: true, nav: true};

  @ViewChild('content') public childModal: NgbModalRef;

  form = new ContactForm('', '', '', 'Quero saber mais sobre o imovél: ');


  constructor(private route: ActivatedRoute, private all: AllImoveis,
              private modalService: NgbModal, private service: ImovelService, private toastr: ToastrService) {

  }

  ngOnInit() {

    this.route.params.subscribe(params => {
      console.log(params)
      if (!this.all.imoveis) {

        this.all.getBySigla(params.id, im => {
          console.log(im);
          this.imovel = im;
          this.buildForm();
        })

      } else {
        this.all.imoveis.forEach(imovel => {
          if (params.id === imovel.sigla) {
            this.imovel = imovel;
            this.buildForm();
          }
        })
      }
    });

    // cd-google-map
  }

  buildForm() {
    this.form = new ContactForm('', '', '', 'Quero saber mais sobre o imovél: ' + this.imovel.sigla);
  }

  submitForm() {
    console.log(this.form);
    this.service.sendGrid(this.form, this.imovel).subscribe(value => {
      console.log(value);
      this.modalService.dismissAll();
      this.toastr.success('Contato enviado!', 'Seus dados foram enviados com sucesso!');
    });
  }


  getFormattedPrice(price: number) {
    return new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'}).format(price).replace(',00', '');
  }


  toArea(imovel: Imovel) {
    if (imovel.tipo === 'casa') {
      const total = imovel.numeros.areas.total.toFixed(0) + ' ' + imovel.numeros.areas.unidade;
      const util = imovel.numeros.areas.total.toFixed(0) + ' ' + imovel.numeros.areas.unidade;
    } else if (imovel.tipo === 'apartamento' || imovel.tipo === 'sala') {
      const num = imovel.numeros.areas.util.toFixed(0) + ' ' + imovel.numeros.areas.unidade;
    } else if (imovel.tipo === 'terreno') {
      const num = imovel.numeros.areas.total.toFixed(0) + ' ' + imovel.numeros.areas.unidade;
    }
    return '?';
  }

  open(content) {
    this.modalService.open(content, {
      ariaLabelledBy: 'modal-basic-title',
      // @ts-ignore
      size: 'md',
      centered: true
    }).result.then((result) => {
    }, (reason) => {
    });
  }

}


export class ContactForm {
  constructor(
    public nome: string,
    public telefone: string,
    public email: string,
    public texto?: string,
    public interesse = 0,
    public midia = 0
  ) {
  }
}
